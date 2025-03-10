import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import type { Root } from 'remark-parse/lib'
import remarkStringify from 'remark-stringify'
import { type Transformer, unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

const polkaCodesRegex = /<!-- polka-codes-start -->[\s\S]*?<!-- polka-codes-end -->/g
const htmlCommentRegex = /<!--[\s\S]*?-->/g

const transformer: Transformer<Root> = (tree) => {
  visit(tree, 'html', (node, index, parent) => {
    const updated = node.value.replace(htmlCommentRegex, '')
    if (updated.length === 0 && parent && index !== undefined) {
      parent.children.splice(index, 1)
      return [SKIP, index]
    }
    node.value = updated
  })
}

const plugin = () => {
  return transformer
}

export const processBody = async (body: string) => {
  const processedBody = body.replace(polkaCodesRegex, '')
  const output = await unified().use(remarkParse).use(remarkStringify).use(remarkGfm).use(plugin).process(processedBody)
  return output.toString()
}
