import { Route } from 'react-static';
import { DocPage, DocsPageNavItem } from '@riboseinc/aperis-doc-pages/types';


export interface PluginConfig {
  sourcePath: string
  urlPrefix: string
  template?: string
  headerBanner: string
  footerBanner: string
  footerBannerLink: string
  title: string
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


export interface DocsPageRouteData {
  urlPrefix: string
  docPage: DocPage
  docsNav: DocsPageNavItem[]
  title: string
  footerBanner: string
  headerBanner: string
  footerBannerLink: string
}


export type SourceDocPageData = {
  importance?: number
  title: string
  summary?: ProseMirrorStructure | string
  contents?: ProseMirrorStructure | string
  excerpt?: string

  media: string[]
  redirectFrom: string[]
}


export type ProseMirrorStructure = { doc: Record<string, any> };
