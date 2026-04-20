import { useEffect, useRef, useState } from 'react'

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const formatIsoToDisplay = (isoDate) => {
  if (!ISO_DATE_REGEX.test(String(isoDate || ''))) return ''
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

const parseDisplayToIso = (displayDate) => {
  const digits = String(displayDate || '').replace(/\D/g, '')
  if (digits.length !== 8) return null

  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))
  const candidate = new Date(year, month - 1, day)

  if (
    candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
  ) {
    return null
  }

  const isoYear = String(year).padStart(4, '0')
  const isoMonth = String(month).padStart(2, '0')
  const isoDay = String(day).padStart(2, '0')
  return `${isoYear}-${isoMonth}-${isoDay}`
}

const normalizeTypedDisplay = (rawValue) => {
  const digits = String(rawValue || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

const isWithinBounds = (isoDate, minDate, maxDate) => {
  if (!isoDate) return false
  if (minDate && isoDate < minDate) return false
  if (maxDate && isoDate > maxDate) return false
  return true
}

export default function DateInput({
  value,
  onChange,
  min,
  max,
  containerClassName = '',
  className = '',
  style,
  id,
  name,
  disabled = false,
  ariaLabel,
}) {
  const [textValue, setTextValue] = useState(formatIsoToDisplay(value))
  const pickerRef = useRef(null)

  useEffect(() => {
    setTextValue(formatIsoToDisplay(value))
  }, [value])

  const commitInput = () => {
    const parsedIso = parseDisplayToIso(textValue)
    if (!parsedIso || !isWithinBounds(parsedIso, min, max)) {
      setTextValue(formatIsoToDisplay(value))
      return
    }

    if (parsedIso !== value) {
      onChange(parsedIso)
      return
    }

    setTextValue(formatIsoToDisplay(parsedIso))
  }

  const openNativePicker = () => {
    if (disabled) return
    if (typeof pickerRef.current?.showPicker === 'function') {
      pickerRef.current.showPicker()
    } else {
      pickerRef.current?.focus()
    }
  }

  return (
    <div className={`relative ${containerClassName}`}>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={textValue}
        onChange={(event) => setTextValue(normalizeTypedDisplay(event.target.value))}
        onBlur={commitInput}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commitInput()
          }
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`${className} pr-14 leading-normal`}
        style={style}
      />

      <div className="absolute inset-y-0 right-2 flex items-center">
        <button
          type="button"
          aria-label="Open date picker"
          onClick={openNativePicker}
          disabled={disabled}
          className="relative h-6 w-6 rounded-md border"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--ink-3)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 mx-auto" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4" />
            <path d="M8 3v4" />
            <path d="M3 11h18" />
          </svg>
          <input
            ref={pickerRef}
            type="date"
            value={value || ''}
            min={min}
            max={max}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="absolute inset-0 cursor-pointer opacity-0"
            tabIndex={-1}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  )
}