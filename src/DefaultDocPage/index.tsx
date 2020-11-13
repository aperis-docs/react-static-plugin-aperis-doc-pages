import React from 'react';
import { Helmet } from 'react-helmet';
import { useRouteData, useRoutePath } from 'react-static';
import { Link as RouterLink, useLocation } from '@reach/router';

import { DocPage as DocPageComponent } from '@riboseinc/aperis-doc-pages';

import RichContents from './RichContents';
import { Link, normalizeInternalHRef, UnstyledLink } from './linksButtons';

import styled from 'styled-components';
import { DocsPageRouteData } from '../types';


export default () => {
  const {
    title,
    siteURLPrefix,
    docsURLPrefix,
    docPage,
    docsNav,
    headerBanner,
    footerBanner,
    footerBannerLink,
  }: DocsPageRouteData = useRouteData();

  const loc = useLocation().pathname;
  const routePath = (useRoutePath as () => string)();

  function pathIsCurrent(path: string, relative?: string | boolean) {
    const normalizedRoutePath = normalizeInternalHRef(loc, path, relative);
    return normalizedRoutePath === `/${prefix ? `${prefix}/` : ''}${routePath}/`;
  }

  const prefix = `${siteURLPrefix}/${docsURLPrefix}`.replace(/^\//, '').replace(/\/$/, '');
  const rootURLPath = prefix === '' ? prefix : `/${prefix}/`;
  const bannerSrcPrefix = prefix === '' ? '/' : `/${prefix}/`;

  if (!docPage?.data) {
    return <p>Missing documentation page data at this path.</p>;
  }

  return (
    <>
      <Helmet>
        <title>{docPage.data?.title} — {title}</title>
      </Helmet>

      <DocPageComponent
        RichContentContainerComponent={RichContents}
        LinkComponent={Link}
        pathIsCurrent={pathIsCurrent}
        rootURLPath={rootURLPath}
        header={<Header to="/"><Symbol alt={title} src={`${bannerSrcPrefix}${headerBanner}`} /></Header>}
        footer={<FooterBanner src={`${bannerSrcPrefix}${footerBanner}`} link={footerBannerLink} />}
        page={docPage}
        nav={docsNav}
      />
    </>
  );
};


const FooterBanner: React.FC<{ src: string, link: string }> = function ({ src, link }) {
  return (
    <UnstyledLink to={link}>
      <FooterSymbol src={src} />
    </UnstyledLink>
  );
};


const Header = styled(RouterLink)`
  height: 3rem;

  display: flex;
  flex-flow: row wrap;
  align-items: center;
  justify-content: center;

  @media screen and (min-width: 800px) {
    justify-content: flex-start;
  }
`;


const Symbol = styled.img`
  height: 3rem;
`;


const FooterSymbol = styled.img`
  height: 16px;
  padding-left: .5rem;
`;
