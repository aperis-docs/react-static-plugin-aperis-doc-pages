import { Schema } from 'prosemirror-model'
import { marks as basicMarks } from 'prosemirror-schema-basic'
import { nodes as basicNodes } from 'prosemirror-schema-basic'
import { orderedList, bulletList, listItem } from 'prosemirror-schema-list'
import { tableNodes } from 'prosemirror-tables'


const listNodes = {
  ordered_list: {
    ...orderedList,
    content: 'list_item+',
    group: 'block'
  },
  bullet_list: {
    ...bulletList,
    content: 'list_item+',
    group: 'block'
  },
  list_item: {
    ...listItem,
    content: 'paragraph block*'
  }
}

const nodes = {
  ...basicNodes,
  ...listNodes,
  ...tableNodes({
    tableGroup: 'block',
    cellContent: 'block+',
    cellAttributes: {},
  }),
}


const subscript = {
  excludes: 'superscript',
  parseDOM: [
    { tag: 'sub' },
    { style: 'vertical-align=sub' }
  ],
  toDOM: () => ['sub']
}

const superscript = {
  excludes: 'subscript',
  parseDOM: [
    { tag: 'sup' },
    { style: 'vertical-align=super' }
  ],
  toDOM: () => ['sup']
}

const strikethrough = {
  parseDOM: [
    { tag: 'strike' },
    { style: 'text-decoration=line-through' },
    { style: 'text-decoration-line=line-through' }
  ],
  toDOM: () => ['span', {
    style: 'text-decoration-line:line-through'
  }]
}

const underline = {
  parseDOM: [
    { tag: 'u' },
    { style: 'text-decoration=underline' }
  ],
  toDOM: () => ['span', {
    style: 'text-decoration:underline'
  }]
}

const marks = {
  ...basicMarks,
  subscript,
  superscript,
  strikethrough,
  underline
}


// @ts-ignore
export default new Schema({ nodes, marks })
