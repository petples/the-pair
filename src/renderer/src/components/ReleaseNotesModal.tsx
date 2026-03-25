import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GlassModal } from './ui/GlassModal'

interface ReleaseNotesModalProps {
  isOpen: boolean
  onClose: () => void
  version: string
  body: string
}

export function ReleaseNotesModal({
  isOpen,
  onClose,
  version,
  body
}: ReleaseNotesModalProps): React.ReactNode {
  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Release Notes - v${version}`}
      className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
    >
      <div className="max-h-[60vh] overflow-y-auto px-6 py-4 prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </GlassModal>
  )
}
