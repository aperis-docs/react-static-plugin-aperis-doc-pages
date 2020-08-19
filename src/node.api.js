import fs from 'fs';
import asciidoctorjs from 'asciidoctor';
import path from 'path';
import dirTree from 'directory-tree';
import probeImageSize from 'probe-image-size';
import yaml from 'js-yaml';


const asciidoctor = asciidoctorjs();


/* Translates an Asciidoc document into a JSON list of top-level sections. */
class SectionJSONExtractor {
  convert(node, transform) {
    const nodeName = transform || node.getNodeName()
    if (nodeName === 'embedded') {
      return `[\n${node.getContent().replace(/,$/, '')}\n]`
    } else if (nodeName === 'section' && node.getLevel() === 1) {
      return `\n  ${JSON.stringify({
        id: node.getId(),
        title: node.getTitle(),
      })},`
    } else {
      return ''
    }
  }
}


asciidoctor.ConverterFactory.register(new SectionJSONExtractor(), ['sectionJSON'])


export default ({ sourcePath, urlPrefix, template }) => ({
  getRoutes: async (routes, state) => {
    const docsDirTree = dirTree(sourcePath, { extensions: /\.yaml$/ });
    if (docsDirTree) {
      const docsNav = await Promise.all(docsDirTree.children.filter(isValid).map(c => getDocsPageItems(c)));
      return [
        ...routes,
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
  const _isIndexFile = entry.type !== 'file';
  const route = {
    path: `${noExt(entry.name) || '/'}`,
    _isIndexFile,
    children: entry.type !== 'file'
      ? entry.children.filter(isValid).map(c => dirEntryToDocsRoute(c, nav, template))
      : undefined,
    template: template,
    getData: getDocsRouteData(entry, nav),
  };
  return route;
}


function getDocsRouteData(entry, docsNav) {
  return async () => {
    const children = (entry.children || []).filter(isValid);
    const dataPath = entry.type === 'file' ? entry.path : `${entry.path}/index.yaml`;
    const _data = await yaml.load(fs.readFileSync(dataPath, { encoding: 'utf-8' }));
    const directoryPath = path.dirname(dataPath);
    const media = await prepareMedia(directoryPath, _data.media);

    const data = {
      ..._data,
      contents: asciidoctor.convert(`:leveloffset: 2\n\n${_data.contents || ''}`),
      sections: JSON.parse(asciidoctor.convert(_data.contents || '', { backend: 'sectionJSON' }) || '[]'),
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
  const dataPath = e.type === 'file' ? e.path : `${e.path}/index.yaml`;
  const directoryPath = path.dirname(dataPath);
  const urlPath = path.join(prefix || '', noExt(e.name));
  const data = await yaml.load(fs.readFileSync(dataPath, { encoding: 'utf-8' }));

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
    return {
      ...itemData,
      excerpt: data.excerpt,
      summary: asciidoctor.convert(data.summary || '', { doctype: 'inline' }),
      media: await prepareMedia(directoryPath, data.media),
    };
  }
}


const DATA_FILE_EXT = '.yaml'


function noExt(filename) {
  return path.basename(filename, DATA_FILE_EXT)
}


function isValid(entry) {
  return (
    entry.name !== 'index.yaml' &&
    entry.name[0] !== '.' &&
    ((entry.children || []).length > 0 || entry.type === 'file')
  );
}


/* Goes through spceified files and attaches metadata
   (such as image dimensions).
   TODO: Can also handle resizing. */

async function prepareMedia(basePath, filenames) {
  if ((filenames || []).length < 1) {
    return [];
  }

  var media = [];

  for (const fn of filenames) {

    const extname = path.extname(fn);

    if (extname === '.png') {
      const imagePath = path.join(basePath, fn);
      const stream = fs.createReadStream(imagePath);

      let width, height;
      try {
        const probeResult = await probeImageSize(stream);
        width = parseInt(probeResult.width, 10);
        height = parseInt(probeResult.height, 10);
      } catch (e) {
        width = null;
        height = null;
        console.error("Failed to parse media data", basePath, fn, e);
      } finally {
        stream.close();
      }

      if (width !== null && height !== null) {
        media.push({
          filename: fn,
          type: 'image',
          dimensions: { width, height },
        });
      }
    } else if (extname === '.svg') {
        media.push({
          filename: fn,
          type: 'image',
        });
    }
  }

  return media;
}
