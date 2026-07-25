export type EditorElementKind = 'text' | 'image' | 'element'

export type EditorStyles = Record<string, string>

export type EditorOverride = {
  selector: string
  page: string
  kind: EditorElementKind
  value?: string
  src?: string
  alt?: string
  hidden?: boolean
  styles?: EditorStyles
}

export type EditorInsertion = {
  id: string
  page: string
  parentSelector: string
  kind: 'text' | 'image'
  value?: string
  src?: string
  alt?: string
  styles?: EditorStyles
}

export type EditorPageDefinition = {
  path: string
  label: string
}

export type EditorState = {
  version: number
  overrides: Record<string, EditorOverride>
  insertions: EditorInsertion[]
  pages: EditorPageDefinition[]
}

export type EditorSelection = {
  selector: string
  parentSelector: string
  page: string
  kind: EditorElementKind
  text: string
  src: string
  alt: string
  tag: string
  insertionId?: string
}

export const defaultEditorState: EditorState = {
  version: 1,
  overrides: {},
  insertions: [],
  pages: [],
}

