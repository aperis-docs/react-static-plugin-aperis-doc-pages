import fs from 'fs';
import path from 'path';
import dirTree, { DirectoryTree } from 'directory-tree';
import yaml from 'js-yaml';
import asciidoctorjs from 'asciidoctor';

import { Route } from 'react-static';
import { DocsPageItem, MediaItem } from '@riboseinc/aperis-doc-pages/types';

import {
  ReactStaticState,
  PluginConfig,
  DocsRoute,
  SourceDocPageData,
  DocsPageRouteData,
} from './types';

import SimpleCache from './SimpleCache';
import AsciidocSectionListConverter from './AsciidocSectionListConverter';
import { prepareMedia } from './pageMedia';



const asciidoctor = asciidoctorjs();
asciidoctor.ConverterFactory.register(new AsciidocSectionListConverter(), ['sectionJSON']);


const cache = new SimpleCache();


export default ({
    sourcePath, urlPrefix, template,
    title,
    footerBanner, headerBanner, footerBannerLink,
}: PluginConfig) => ({

  getRoutes: async (routes: Route[], _state: ReactStaticState) => {
    const docsDirTree = dirTree(sourcePath, { extensions: /\.yaml$/ });

    if (docsDirTree) {
      docsDirTree.name = urlPrefix;

      const effectiveTemplate = template || path.join(__dirname, 'DefaultDocPage/index.js');

      const [docsNav, redirectRoutes] = await Promise.all([
        await Promise.all(
          (docsDirTree.children || []).filter(isValid).map(c => getDocsPageItems(c))
        ),
        await Promise.all(
          (docsDirTree.children || []).map(c => getRedirects(urlPrefix, c, urlPrefix))
        ),
      ]);

      return [
        ...routes,
        ...redirectRoutes.flat(),
        ...[docsDirTree].map(entry => dirEntryToDocsRoute(
            entry,
            [],
            effectiveTemplate,
            { urlPrefix, docsNav, title, headerBanner, footerBanner, footerBannerLink })),
      ];

    } else {
      return routes;
    }
  },

  afterExport: async (state: ReactStaticState) => {
    const docsURLPrefix = `${urlPrefix}/`;
    const docsSrcPrefix = path.basename(sourcePath);
    const docsOutPrefix = `dist/${urlPrefix}`;

    fs.copyFileSync(path.join(sourcePath, headerBanner), path.join(docsOutPrefix, headerBanner));
    fs.copyFileSync(path.join(sourcePath, footerBanner), path.join(docsOutPrefix, footerBanner));

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


function dirEntryToDocsRoute(
  entry: DirectoryTree,
  parents: DirectoryTree[],
  template: string,
  context: Omit<DocsPageRouteData, 'docPage'>,
): DocsRoute {
  return {
    path: dirEntryNameToRoutePath(entry.name),
    children: entry.type !== 'file'
      ? (entry.children || []).filter(isValid).map(childEntry =>
          dirEntryToDocsRoute(
            childEntry,
            [ ...parents, entry ],
            template,
            context))
      : undefined,
    template,
    getData: getDocsRouteData(entry, parents, context),
    _isIndexFile: entry.type !== 'file', // TODO: Is a crutch
  };
}


function getDocsRouteData(
  entry: DirectoryTree,
  parentEntries: DirectoryTree[],
  context: Omit<DocsPageRouteData, 'docPage'>,
): () => Promise<DocsPageRouteData> {
  return async () => {
    const children = (entry.children || []).filter(isValid);
    const dataPath = getDataFilePathForDirTreeEntry(entry);
    const _data = await getFileData(dataPath);
    const media = await getMedia(dataPath);

    const breadcrumbs = [];
    for (const pe of parentEntries) {
      const peDataPath = path.join(
        path.dirname(getDataFilePathForDirTreeEntry(pe)),
        'index.yaml');
      const peData = await getFileData(peDataPath);
      breadcrumbs.push({
        title: peData.title,
      });
    }

    const data = {
      ..._data,
      breadcrumbs,
      contents: asciidoctor.convert(`:leveloffset: 2\n\n${_data.contents || ''}`) as string,
      sections: JSON.parse(
        (asciidoctor.convert(_data.contents || '', { backend: 'sectionJSON' }) as string)
        || '[]'),
      summary: asciidoctor.convert(_data.summary || '', { doctype: 'inline' }) as string,
      media,
    };

    return {
      ...context,
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


async function getDocsPageItems(
  e: DirectoryTree,
  readContents?: boolean,
  prefix?: string,
): Promise<DocsPageItem> {

  const children = (e.children || []).filter(isValid);
  const urlPath = path.join(prefix || '', dirEntryNameToRoutePath(e.name));
  const dataPath = getDataFilePathForDirTreeEntry(e);
  const data = await getFileData(dataPath);

  const itemData: DocsPageItem = {
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
    const summary: string = asciidoctor.convert(data.summary || '', { doctype: 'inline' }) as string;

    return {
      ...itemData,
      excerpt: data.excerpt,
      summary,
      media,
    };
  }
}


/* Recursively collect redirects from given and nested directory tree entries */
async function getRedirects(urlRoot: string, dirTreeEntry: DirectoryTree, prefix: string) {
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

  const childRedirectRoutes: Route[][] = dirTreeEntry.type !== 'file'
    ? await Promise.all(
        (dirTreeEntry.children || []).
        filter(isValid).
        map(c => getRedirects(urlRoot, c, routePath)))
    : [];

  return [ ...redirectRoutes, ...(childRedirectRoutes.flat()) ];
}


/* Getting data from YAML per dir tree entry */
async function getFileData(dataFilePath: string): Promise<SourceDocPageData> {
  return await cache.get(`file-${dataFilePath}`, async () => {
    return await yaml.load(fs.readFileSync(dataFilePath, { encoding: 'utf-8' }));
  });
}


/* Getting media */
async function getMedia(dataFilePath: string): Promise<MediaItem[]> {
  return await cache.get(`media-${dataFilePath}`, async () => {
    const directoryPath = path.dirname(dataFilePath);
    const _data = await getFileData(dataFilePath);
    return await prepareMedia(directoryPath, _data.media);
  });
}


/* Data reading utilities */

const DATA_FILE_EXT = '.yaml';
const INDEX_DATA_FILE_NAME = `index.yaml`;


function getDataFilePathForDirTreeEntry(entry: DirectoryTree): string {
  return entry.type === 'file' ? entry.path : `${entry.path}/${INDEX_DATA_FILE_NAME}`;
}


function noExt(filename: string): string {
  return path.basename(filename, DATA_FILE_EXT);
}


function dirEntryNameToRoutePath(name: string): string {
  return `${noExt(name) || '/'}`;
}


function isValid(dirTreeEntry: DirectoryTree): boolean {
  return (
    dirTreeEntry.name !== INDEX_DATA_FILE_NAME &&
    dirTreeEntry.name[0] !== '.' &&
    ((dirTreeEntry.children || []).length > 0 || dirTreeEntry.type === 'file'));
}
