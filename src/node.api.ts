import fs from 'fs';
import path from 'path';
import dirTree, { DirectoryTree } from 'directory-tree';
import yaml from 'js-yaml';

import asciidoctorjs from 'asciidoctor';
import { Node, DOMSerializer } from 'prosemirror-model';
import { default as proseMirrorSchema } from './prosemirror-schema'
import jsdom from 'jsdom';

import { Route } from 'react-static';
import { DocsPageItem, MediaItem } from '@riboseinc/aperis-doc-pages/types';

import {
  ReactStaticState,
  PluginConfig,
  DocsRoute,
  SourceDocPageData,
  DocsPageRouteData,
  ProseMirrorStructure,
} from './types';

import SimpleCache from './SimpleCache';
import AsciidocSectionListConverter from './AsciidocSectionListConverter';
import { prepareMedia } from './pageMedia';



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
      contents: convertRichContentToHTML(_data.contents || ''),
      sections: getSectionList(_data.contents || ''),
      summary: convertRichContentToHTML(_data.summary || '', { inline: true }),
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
    hasContents: data.contents !== undefined
      ? isProseMirrorStructure(data.contents)
        ? data.contents.doc.content !== undefined
        : (data.contents || '').trim() !== ''
      : false,
    items: await Promise.all(children.map(c => getDocsPageItems(c, readContents, urlPath))),
  }

  if (readContents !== true) {
    return itemData;
  } else {
    const media = await getMedia(dataPath);
    const summary: string = convertRichContentToHTML(data.summary || '', { inline: true });

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


/* Rich content conversion utilities */


const asciidoctor = asciidoctorjs();
asciidoctor.ConverterFactory.register(new AsciidocSectionListConverter(), ['sectionJSON']);


type ProseMirrorStructure = { doc: Record<string, any> }
interface RichContentConversionOptions {
  headingLevelOffset?: number
  inline?: boolean
}


function isProseMirrorStructure(data: string | ProseMirrorStructure): data is ProseMirrorStructure {
  return data.hasOwnProperty('doc');
}


function convertRichContentToHTML(
    data: string | ProseMirrorStructure,
    opts?: RichContentConversionOptions,
): string {
  if (isProseMirrorStructure(data)) {
    const dom = new jsdom.JSDOM('<!DOCTYPE html><div id="content"></div>')
    const targetDoc = dom.window.document
    const targetElement = targetDoc.querySelector('div')
    const node = Node.fromJSON(proseMirrorSchema, data.doc)
    DOMSerializer.
      fromSchema(proseMirrorSchema).
      // @ts-ignore: 2554 (serializeFragment supports third argument, but is not properly typed)
      serializeFragment(node, { document: targetDoc }, targetElement)
    const html = targetDoc.querySelector('div')?.innerHTML
    if (html !== undefined) {
      return html
    } else {
      console.error("Unable to render ProseMirror contents", data)
      throw new Error("Unable to render ProseMirror contents")
    }

  } else {
    let adocContents: string
    let doctorOptions: Record<string, any> | undefined
    if (opts?.headingLevelOffset !== undefined) {
      adocContents = `
        :leveloffset: ${opts.headingLevelOffset}\n\n${data || ''}
      `
    } else {
      adocContents = data
    }
    if (opts?.inline) {
      doctorOptions = { doctype: 'inline' }
    } else {
      doctorOptions = undefined
    }
    return asciidoctor.convert(adocContents, doctorOptions) as string;
  }
}


function getSectionList(
    data: string | ProseMirrorStructure,
): { id: string, title: string }[] {
  if (isProseMirrorStructure(data)) {
    return []; // TODO: Get proper section list from ProseMirror structure
  } else {
    return JSON.parse(
      (asciidoctor.convert(data, { backend: 'sectionJSON' }) as string)
      || '[]');
  }
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
