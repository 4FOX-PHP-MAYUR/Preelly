export default function FormInput({
  icon: Icon,
  type = 'text',
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  disabled = false,
  readOnly = false,
  className = '',
  inputClassName = '',
  rightElement,
  id,
  name,
  autoComplete,
  inputMode,
  'aria-label': ariaLabel,
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-3.5 transition duration-200 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10 ${
        disabled ? 'opacity-60' : 'hover:border-slate-300'
      } ${className}`}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden /> : null}
      <input
        id={id}
        name={name}
        type={type}
        value={value ?? ''}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-label={ariaLabel || placeholder}
        className={`min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none ${inputClassName}`}
      />
      {rightElement}
    </div>
  )
}
