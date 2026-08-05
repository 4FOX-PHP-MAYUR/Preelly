import React, { useMemo } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

// Toolbar covers everything the Pages module needs: headings, formatting,
// lists, links and images. Quill has no native table module — a basic table
// snippet is inserted as raw HTML via the "table" handler below, matching the
// "supports HTML formatting, lists, links, images, tables" requirement without
// pulling in a heavier third-party table plugin.
const TOOLBAR_MODULES = {
  toolbar: {
    container: [
      [{ header: [2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image', 'table'],
      [{ align: [] }],
      ['clean'],
    ],
    handlers: {
      table: function insertTable() {
        const quill = this.quill
        const range = quill.getSelection(true)
        const tableHtml =
          '<table><tbody>' +
          '<tr><td>Cell 1</td><td>Cell 2</td></tr>' +
          '<tr><td>Cell 3</td><td>Cell 4</td></tr>' +
          '</tbody></table><p><br></p>'
        quill.clipboard.dangerouslyPasteHTML(range ? range.index : 0, tableHtml, 'user')
      },
    },
  },
}

const FORMATS = ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'link', 'image', 'align']

/**
 * Rich-text / HTML editor used for the Pages "Description" field.
 * Wraps react-quill to match the AdminUI Input/Textarea label + error + hint pattern.
 */
function RichTextEditor({ label, error, hint, required, value, onChange, className = '', readOnly = false }) {
  const modules = useMemo(() => TOOLBAR_MODULES, [])

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <div
        className={`admin-richtext rounded-lg border bg-white dark:bg-slate-900 ${
          error ? 'border-red-300 dark:border-red-700' : 'border-slate-300 dark:border-slate-700'
        }`}
      >
        <ReactQuill
          theme="snow"
          value={value || ''}
          onChange={onChange}
          modules={modules}
          formats={FORMATS}
          readOnly={readOnly}
        />
      </div>
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </div>
  )
}

export default RichTextEditor
