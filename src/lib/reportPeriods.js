const normalizeDate = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const toInputDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getPreviousMonthRange = (now = new Date()) => {
  const end = normalizeDate(now)
  end.setDate(0)

  const start = new Date(end.getFullYear(), end.getMonth(), 1)

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  }
}