export function PreviewPanel({ payload }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        Preview Payload
      </h2>
      <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs overflow-auto max-h-96">
        {JSON.stringify(payload, null, 2)}
      </pre>
      <p className="mt-2 text-xs text-gray-500">
        File fields are previewed as file names.
      </p>
    </div>
  )
}

