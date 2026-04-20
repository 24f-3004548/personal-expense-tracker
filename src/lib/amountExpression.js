const isDigit = (char) => char >= '0' && char <= '9'

const OPERATORS = {
  '+': { precedence: 1, rightAssociative: false },
  '-': { precedence: 1, rightAssociative: false },
  '*': { precedence: 2, rightAssociative: false },
  '/': { precedence: 2, rightAssociative: false },
  '^': { precedence: 3, rightAssociative: true },
}

const tokenize = (expression) => {
  const tokens = []
  let index = 0

  while (index < expression.length) {
    const char = expression[index]

    if (isDigit(char) || char === '.') {
      let dotCount = char === '.' ? 1 : 0
      let cursor = index + 1

      while (cursor < expression.length) {
        const next = expression[cursor]
        if (isDigit(next)) {
          cursor += 1
          continue
        }
        if (next === '.') {
          dotCount += 1
          if (dotCount > 1) return null
          cursor += 1
          continue
        }
        break
      }

      const numberToken = expression.slice(index, cursor)
      if (numberToken === '.') return null

      tokens.push(numberToken)
      index = cursor
      continue
    }

    if (char in OPERATORS || char === '(' || char === ')') {
      tokens.push(char)
      index += 1
      continue
    }

    return null
  }

  return tokens
}

const toRpn = (tokens) => {
  const output = []
  const operators = []
  let previousType = null

  tokens.forEach((token) => {
    if (!(token in OPERATORS) && token !== '(' && token !== ')') {
      output.push(token)
      previousType = 'number'
      return
    }

    if (token in OPERATORS) {
      const isUnary = previousType === null || previousType === 'operator' || previousType === 'open'
      if (isUnary && (token === '+' || token === '-')) {
        output.push('0')
      } else if (isUnary) {
        throw new Error('Invalid operator placement')
      }

      const current = OPERATORS[token]
      while (operators.length > 0) {
        const top = operators[operators.length - 1]
        if (!(top in OPERATORS)) break

        const topOperator = OPERATORS[top]
        const shouldPop = current.rightAssociative
          ? current.precedence < topOperator.precedence
          : current.precedence <= topOperator.precedence

        if (!shouldPop) break
        output.push(operators.pop())
      }

      operators.push(token)
      previousType = 'operator'
      return
    }

    if (token === '(') {
      operators.push(token)
      previousType = 'open'
      return
    }

    while (operators.length > 0 && operators[operators.length - 1] !== '(') {
      output.push(operators.pop())
    }

    if (operators.length === 0) {
      throw new Error('Mismatched parentheses')
    }

    operators.pop()
    previousType = 'close'
  })

  while (operators.length > 0) {
    const op = operators.pop()
    if (op === '(' || op === ')') {
      throw new Error('Mismatched parentheses')
    }
    output.push(op)
  }

  return output
}

const evaluateRpn = (rpnTokens) => {
  const stack = []

  rpnTokens.forEach((token) => {
    if (!(token in OPERATORS)) {
      const value = Number(token)
      if (!Number.isFinite(value)) throw new Error('Invalid number')
      stack.push(value)
      return
    }

    if (stack.length < 2) throw new Error('Invalid expression')
    const right = stack.pop()
    const left = stack.pop()

    let result
    switch (token) {
      case '+':
        result = left + right
        break
      case '-':
        result = left - right
        break
      case '*':
        result = left * right
        break
      case '/':
        if (right === 0) throw new Error('Division by zero')
        result = left / right
        break
      case '^':
        result = Math.pow(left, right)
        break
      default:
        throw new Error('Unknown operator')
    }

    if (!Number.isFinite(result)) throw new Error('Result is not finite')
    stack.push(result)
  })

  if (stack.length !== 1 || !Number.isFinite(stack[0])) {
    throw new Error('Invalid expression result')
  }

  return stack[0]
}

export const evaluateAmountExpression = (rawInput) => {
  const trimmed = String(rawInput ?? '').trim()
  if (!trimmed) return null

  const noSeparators = trimmed.replace(/,/g, '').replace(/\s+/g, '')
  const expression = noSeparators.startsWith('=') ? noSeparators.slice(1) : noSeparators
  if (!expression) return null

  const numericOnly = Number(expression)
  if (Number.isFinite(numericOnly) && /^[+-]?(\d+\.?\d*|\.\d+)$/.test(expression)) {
    return numericOnly
  }

  const tokens = tokenize(expression)
  if (!tokens || tokens.length === 0) return null

  try {
    const rpnTokens = toRpn(tokens)
    return evaluateRpn(rpnTokens)
  } catch {
    return null
  }
}

export const formatAmountForInput = (value) => {
  if (!Number.isFinite(value)) return ''
  const rounded = Number(value.toFixed(6))
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}
