import fs from 'fs';
import path from 'path';
import dirTree from 'directory-tree';
import yaml from 'js-yaml';
import asciidoctorjs from 'asciidoctor';

import SimpleCache from './SimpleCache';
import AsciidocSectionListConverter from './AsciidocSectionListConverter';
import { prepareMedia } from './pageMedia';


const asciidoctor = asciidoctorjs();
asciidoctor.ConverterFactory.register(new AsciidocSectionListConverter(), ['sectionJSON']);


const cache = new SimpleCache();


export default ({ sourcePath, urlPrefix, template }) => ({
  getRoutes: async (routes, state) => {
    const docsDirTree = dirTree(sourcePath, { extensions: /\.yaml$/ });
    if (docsDirTree) {

      const [docsNav, redirectRoutes] = await Promise.all([
        await Promise.all(
          docsDirTree.children.filter(isValid).map(c => getDocsPageItems(c))
        ),
        await Promise.all(
          docsDirTree.children.map(c => getRedirects(urlPrefix, c, urlPrefix))
        ),
      ]);

      return [
        ...routes,
        ...redirectRoutes.flat(),
        ...[docsDirTree].map(e => dirEntryToDocsRoute(e, docsNav, template)),
      ];

    } else {
      return routes;
    }
  },

  afterExport: async state => {
    const docsURLPrefix = `${urlPrefix}/`;
    const docsSrcPrefix = path.basename(sourcePath);
    const docsOutPrefix = `dist/${urlPrefix}`;

    for (const r of state.routes) {
      if (r.path.indexOf(docsURLPrefix) === 0) {
        const id = r.path.replace(docsURLPrefix, '');
        const _data = r.data?.docPage?.data;
        if (!_data) {
        } else {
          const media = (_data.media || []);
          for (const f of media) {
            fs.copyFileSync(
              `${docsSrcPrefix}/${r._isIndexFile ? id : path.dirname(id)}/${f.filename}`,
              `${docsOutPrefix}/${id}/${f.filename}`);
          }
        }
      }
    }

    return state;
  },
});


function dirEntryToDocsRoute(entry, nav, template) {
  return {
    path: dirEntryNameToRoutePath(entry.name),
    _isIndexFile: entry.type !== 'file',
    children: entry.type !== 'file'
      ? entry.children.filter(isValid).map(c => dirEntryToDocsRoute(c, nav, template))
      : undefined,
    template: template,
    getData: getDocsRouteData(entry, nav),
  };
}


function getDocsRouteData(entry, docsNav) {
  return async () => {
    const children = (entry.children || []).filter(isValid);
    const dataPath = getDataFilePathForDirTreeEntry(entry);
    const _data = await getFileData(dataPath);
    const media = await getMedia(dataPath);

    const data = {
      ..._data,
      contents: asciidoctor.convert(`:leveloffset: 2\n\n${_data.contents || ''}`),
      sections: JSON.parse(
        asciidoctor.convert(_data.contents || '', { backend: 'sectionJSON' }) || '[]'),
      summary: asciidoctor.convert(_data.summary || '', { doctype: 'inline' }),
      media,
    };

    return {
      docsNav,
      docPage: {
        id: noExt(entry.name),
        items: entry.type !== 'file'
          ? await Promise.all(children.map(c => getDocsPageItems(c, true)))
          : undefined,
        data,
      },
    };
  };
}


async function getDocsPageItems(e, readContents, prefix) {
  const children = (e.children || []).filter(isValid);
  const urlPath = path.join(prefix || '', dirEntryNameToRoutePath(e.name));
  const dataPath = getDataFilePathForDirTreeEntry(e);
  const data = await getFileData(dataPath);

  const itemData = {
    id: noExt(e.name),
    path: urlPath,
    importance: data.importance,
    title: data.title || 'NO TITLE',
    hasContents: (data.contents || '').trim() !== '',
    items: await Promise.all(children.map(c => getDocsPageItems(c, readContents, urlPath))),
  }

  if (readContents !== true) {
    return itemData;
  } else {
    const media = await getMedia(dataPath);

    return {
      ...itemData,
      excerpt: data.excerpt,
      summary: asciidoctor.convert(data.summary || '', { doctype: 'inline' }),
      media,
    };
  }
}


/* Recursively collect redirects from given and nested directory tree entries */
async function getRedirects(urlRoot, dirTreeEntry, prefix) {
  const dataPath = getDataFilePathForDirTreeEntry(dirTreeEntry);
  const data = await getFileData(dataPath);
  const routePath = path.join(prefix || '', dirEntryNameToRoutePath(dirTreeEntry.name));

  const redirectRoutes = [];

  if (data.redirectFrom) {
    for (const redirectedURL of data.redirectFrom) {
      redirectRoutes.push({
        path: path.join(urlRoot || '', redirectedURL),
        redirect: routePath,
      });
    }
  }

  const childRedirectRoutes = dirTreeEntry.type !== 'file'
    ? await Promise.all(
        (dirTreeEntry.children || []).
        filter(isValid).
        map(c => getRedirects(urlRoot, c, routePath)))
    : [];

  return [ ...redirectRoutes, ...(childRedirectRoutes.flat()) ];
}


/* Getting data from YAML per dir tree entry */
async function getFileData(dataFilePath) {
  return await cache.get(`file-${dataFilePath}`, async () => {
    return await yaml.load(fs.readFileSync(dataFilePath, { encoding: 'utf-8' }));
  });
}


/* Getting media */
async function getMedia(dataFilePath) {
  return await cache.get(`media-${dataFilePath}`, async () => {
    const directoryPath = path.dirname(dataFilePath);
    const _data = await getFileData(dataFilePath);
    return await prepareMedia(directoryPath, _data.media);
  });
}


/* Data reading utilities */

const DATA_FILE_EXT = '.yaml';
const INDEX_DATA_FILE_NAME = `index.yaml`;


function getDataFilePathForDirTreeEntry(entry) {
  return entry.type === 'file' ? entry.path : `${entry.path}/${INDEX_DATA_FILE_NAME}`;
}


function noExt(filename) {
  return path.basename(filename, DATA_FILE_EXT);
}


function dirEntryNameToRoutePath(name) {
  return `${noExt(name) || '/'}`;
}


function isValid(dirTreeEntry) {
  return (
    dirTreeEntry.name !== INDEX_DATA_FILE_NAME &&
    dirTreeEntry.name[0] !== '.' &&
    ((dirTreeEntry.children || []).length > 0 || dirTreeEntry.type === 'file'));
}
