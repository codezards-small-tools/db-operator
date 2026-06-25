import { Button, type ButtonProps } from 'antd'

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger'

type AppButtonProps = Omit<ButtonProps, 'type' | 'ghost' | 'danger' | 'variant'> & {
  variant?: AppButtonVariant
}

function getVariantProps(
  variant: AppButtonVariant
): Pick<ButtonProps, 'type' | 'ghost' | 'danger'> & { className: string } {
  switch (variant) {
    case 'primary':
      return { type: 'primary', className: 'app-btn app-btn--primary' }
    case 'secondary':
      return { type: 'default', className: 'app-btn app-btn--secondary' }
    case 'ghost':
      return { type: 'default', ghost: true, className: 'app-btn app-btn--ghost' }
    case 'icon':
      return { type: 'text', className: 'app-btn app-btn--icon' }
    case 'danger':
      return { type: 'text', danger: true, className: 'app-btn app-btn--danger' }
  }
}

export default function AppButton({
  variant = 'secondary',
  size = 'small',
  className,
  ...rest
}: AppButtonProps): React.JSX.Element {
  const variantProps = getVariantProps(variant)
  const mergedClassName = [variantProps.className, className].filter(Boolean).join(' ')

  return (
    <Button
      size={size}
      type={variantProps.type}
      ghost={variantProps.ghost}
      danger={variantProps.danger}
      className={mergedClassName}
      {...rest}
    />
  )
}
