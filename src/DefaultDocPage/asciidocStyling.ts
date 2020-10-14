import { css } from 'styled-components';
import asciidocBaseCSS from '!!raw-loader!./asciidoctor.css';
import colors from './colors';


export const asciidocBaseStyling = css`
  ${asciidocBaseCSS}

  &, p {
    font-size: .95em;
    line-height: 1.7;
    font-weight: 300;
  }

  a, a:link, a:visited {
    color: ${colors.link.css()};
  }
`;


export const asciidocWithBlocks = css`
  ${asciidocBaseStyling}

  .admonitionblock {
    .content {
      font-size: inherit;
    }

    > table > tbody > tr {
      > td.icon {
        padding: 0;
        font-size: .95em; // matches asciidoctor.css
        line-height: 1.7; // matches asciidoctor.css
      }
      > td.content {
        padding-top: 0;
        padding-bottom: 0;
      }

      @media screen and (max-width: 800px) {
        display: flex;
        flex-flow: column nowrap;
        align-items: flex-start;
      }
    }
  }

  .imageblock, .admonitionblock, .listingblock {
    margin-top: 1em;
  }

  .listingblock {
    @media screen and (max-width: 800px) {
      margin-left: -1rem;
      margin-right: -1rem;

      > .content > pre {
        padding-left: 1rem;
      }
    }
  }


  // List item spacing

  p, ol > li p, ul > li p {
    margin-bottom: 0;
  }


  // Paragraph indentation

  p + p {
    text-indent: 1.5em;
  }

  .paragraph + .paragraph {
    p {
      text-indent: 1.5em;
    }
  }


  // Image dimensions

  @media screen and (min-width: 800px) {
    img {
      max-width: 50vw;
      max-height: 50vh;
    }
    .imageblock.unbounded-image img {
      max-width: 100%;
      max-height: unset;
    }
  }

  .imageblock {
    padding: 1.2rem;
    background: whiteSmoke;

    .content {
      text-align: center;
    }

    img {
      box-shadow: rgba(0, 0, 0, 0.15) .1rem .1rem 1rem;
    }

    &.unbounded-image {
      padding: unset;
      background: unset;

      img {
        box-shadow: unset;
      }
    }
  }
`;
