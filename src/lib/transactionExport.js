export const buildTransactionWorkbookBase64 = async (transactions, startDate, endDate) => {
  const xlsxModule = await import('xlsx')
  const XLSX = xlsxModule.default ?? xlsxModule

  const transactionRows = [
    ['Date', 'Category', 'Amount', 'Notes'],
    ...transactions.map((transaction) => ([
      transaction.date,
      transaction.category,
      Number(transaction.amount) || 0,
      transaction.note || '',
    ])),
  ]

  const summaryRows = [
    ['Field', 'Value'],
    ['Start date', startDate],
    ['End date', endDate],
    ['Transactions', transactions.length],
    ['Income entries', transactions.filter((transaction) => transaction._type === 'income').length],
    ['Expense entries', transactions.filter((transaction) => transaction._type === 'expense').length],
  ]

  const workbook = XLSX.utils.book_new()
  const transactionsSheet = XLSX.utils.aoa_to_sheet(transactionRows)
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)

  XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions')
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' })
}