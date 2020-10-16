import React from 'react';
import styled from 'styled-components';
import { asciidocBaseStyling, asciidocWithBlocks } from './asciidocStyling';

//import colors from './colors';


const RichContents:
React.FC<{
  content: string
  inline?: boolean
  className?: string
  style?: React.CSSProperties
}> =
function ({ content, inline, className, style }) {
  if (inline) {
    return <StyledRichContentsInline
      style={style}
      className={className}
      dangerouslySetInnerHTML={{ __html: content }} />;
  } else {
    return <StyledRichContents
      style={style}
      className={className}
      dangerouslySetInnerHTML={{ __html: content }} />;
  }
};

export default RichContents;


const StyledRichContentsInline = styled.p`
  ${asciidocBaseStyling}
`;


const StyledRichContents = styled.div`
  ${asciidocWithBlocks}

  figure {
    margin: 1em 0;
    padding: 1rem;
    background: whiteSmoke;

    figcaption {
      margin-top: .5em;
      font-weight: bold;
      font-size: 85%;
    }
  }

  section {
    > header {
      color: #ba3925;
      font-size: 1.375em;
      line-height: 1.2;
      margin-top: 1em;
      margin-bottom: .5em;
    }
    section > header {
      font-size: 1.125em;
    }
  }

  div[data-admonition-type] {
    margin-top: 1em;
    margin-bottom: 1em;

    display: flex;
    flex-flow: row nowrap;
    align-items: stretch;

    @media screen and (max-width: 800px) {
      flex-flow: column nowrap;
      align-items: flex-start;
    }

    [data-admonition-type-label] {
      display: flex;
      flex-flow: row nowrap;
      align-items: center;

      font-size: .95em;
      line-height: 1.7;
      padding: 0 2em;

      font-weight: bold;
      text-transform: uppercase;
      border-right: 1px solid silver;
      margin-right: 1rem;
    }
  }
`;
