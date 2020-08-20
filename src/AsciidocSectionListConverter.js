/* Translates an Asciidoc document into a JSON list of top-level sections. */
export default class AsciidocSectionListConverter {
  convert(node, transform) {
    const nodeName = transform || node.getNodeName();
    if (nodeName === 'embedded') {
      return `[\n${node.getContent().replace(/,$/, '')}\n]`;
    } else if (nodeName === 'section' && node.getLevel() === 1) {
      return `\n  ${JSON.stringify({
        id: node.getId(),
        title: node.getTitle(),
      })},`;
    } else {
      return '';
    }
  }
}
