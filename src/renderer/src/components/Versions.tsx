import { useState, useEffect } from 'react'
import { getVersion } from '@tauri-apps/api/app'

function Versions(): React.JSX.Element {
  const [version, setVersion] = useState<string>('...')

  useEffect(() => {
    getVersion().then(setVersion)
  }, [])

  return (
    <ul className="versions">
      <li className="app-version">The Pair v{version}</li>
      <li className="framework-version">Tauri v2.0</li>
    </ul>
  )
}

export default Versions
