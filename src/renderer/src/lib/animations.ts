import { type Variants } from 'framer-motion'

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }
}

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } }
}

export const slideInFromRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } }
}

export const slideInFromLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } }
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08
    }
  }
}

export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04
    }
  }
}

export const cardHover: Variants = {
  idle: { scale: 1, borderColor: 'rgba(255, 255, 255, 0.06)' },
  hover: {
    scale: 1.01,
    borderColor: 'rgba(140, 180, 255, 0.18)',
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
  }
}

export const pulse: Variants = {
  idle: { opacity: 1 },
  pulse: {
    opacity: [1, 0.5, 1],
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
  }
}

export const shimmer: Variants = {
  idle: { backgroundPosition: '200% 0' },
  shimmer: {
    backgroundPosition: '-200% 0',
    transition: { duration: 2, repeat: Infinity, ease: 'linear' }
  }
}

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } }
}

export const turnCardFinalize: Variants = {
  live: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0 }
  },
  final: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 }
  }
}

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: { duration: 0.2, ease: 'easeIn' }
  }
}
