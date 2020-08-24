import { Route } from 'react-static';
import { DocPage } from '@riboseinc/aperis-doc-pages/types';


export interface PluginConfig {
  sourcePath: string
  urlPrefix: string
  template: string
}


export interface ReactStaticState {
  routes: {
    path: string
    data: any
    [key: string]: any
  }[]
}


export interface DocsRoute extends Route {
  _isIndexFile: boolean
}


export type DocPageData = DocPage["data"]

export type SourceDocPageData = DocPageData & {
  media: string[]
  redirectFrom: string[]
  importance?: number
}
