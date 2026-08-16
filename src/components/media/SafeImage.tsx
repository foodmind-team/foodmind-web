import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react'

type SafeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError' | 'referrerPolicy'> & {
  src?: string | null
  fallback: ReactNode
}

export function SafeImage({ src, fallback, loading = 'lazy', ...imageProps }: SafeImageProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  if (!src || failed) return <>{fallback}</>

  return (
    <img
      {...imageProps}
      src={src}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
