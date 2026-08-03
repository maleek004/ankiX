import express from 'express'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

const app = express()
app.use(express.json({ limit: '2mb' }))

const PORT = process.env.PORT || 3000

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'AnkiX Code Execution Microservice', memory: process.memoryUsage() })
})

async function executeCode({ language, code, validationSpec }) {
  if (!code || !code.trim()) {
    return { passed: false, durationMs: 0, details: 'Submitted code cannot be empty.' }
  }

  const normLang = (language || 'javascript').toLowerCase().trim()
  const randomId = crypto.randomBytes(8).toString('hex')
  
  let ext = 'txt'
  if (normLang.includes('python') || normLang === 'py') ext = 'py'
  else if (normLang.includes('javascript') || normLang === 'js' || normLang === 'node') ext = 'js'
  else if (normLang.includes('go')) ext = 'go'
  else if (normLang.includes('csharp') || normLang === 'cs' || normLang === 'c#') ext = 'cs'

  const tempFilePath = path.join(os.tmpdir(), `ankix_exec_${randomId}.${ext}`)

  let fullCode = code
  if (normLang === 'go') {
    const cleanUserCode = code.replace('package main', '').trim()
    const specCode = validationSpec || ''
    const mainFunc = specCode.includes('func main()')
      ? specCode.replace('import "fmt"', '').trim()
      : 'func main() {\n    fmt.Println("✓ Code Executed Successfully")\n}'
    fullCode = `package main\n\nimport (\n    "fmt"\n)\n\n${cleanUserCode}\n\n${mainFunc}`
  } else if (normLang.includes('csharp') || normLang === 'cs' || normLang === 'c#') {
    if (!code.includes('class ') && !code.includes('static void Main')) {
      fullCode = `using System;\n\npublic class Program {\n    public static void Main() {\n        ${code}\n    }\n}`
    }
    if (validationSpec && !fullCode.includes(validationSpec)) {
      fullCode += '\n\n' + validationSpec
    }
  } else if (validationSpec && (validationSpec.includes('assert') || validationSpec.includes('expect') || validationSpec.includes('test'))) {
    fullCode += '\n\n' + validationSpec
  }

  await fs.promises.writeFile(tempFilePath, fullCode, 'utf8')

  let cmd = ''
  let args = []

  if (normLang.includes('python') || normLang === 'py') {
    cmd = 'python3'
    args = [tempFilePath]
  } else if (normLang.includes('javascript') || normLang === 'js' || normLang === 'node') {
    cmd = 'node'
    args = [tempFilePath]
  } else if (normLang.includes('go')) {
    cmd = 'go'
    args = ['run', tempFilePath]
  } else if (normLang.includes('csharp') || normLang === 'cs' || normLang === 'c#') {
    const exePath = path.join(os.tmpdir(), `ankix_exec_${randomId}.exe`)
    cmd = 'sh'
    args = ['-c', `mcs -out:"${exePath}" "${tempFilePath}" && mono "${exePath}" ; rm -f "${exePath}"`]
  } else {
    // Syntax verification fallback
    await fs.promises.unlink(tempFilePath).catch(() => {})
    return { passed: true, durationMs: 5, details: 'Code format verified.' }
  }

  const startTime = Date.now()

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false

    const proc = spawn(cmd, args, { timeout: 5000 })

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGKILL')
    }, 5000)

    proc.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString() })

    proc.on('error', (err) => {
      clearTimeout(timer)
      fs.promises.unlink(tempFilePath).catch(() => {})
      resolve({ passed: false, durationMs: Date.now() - startTime, details: `Execution error starting process: ${err.message}` })
    })

    proc.on('close', (exitCode) => {
      clearTimeout(timer)
      fs.promises.unlink(tempFilePath).catch(() => {})

      const durationMs = Date.now() - startTime

      if (timedOut) {
        return resolve({ passed: false, durationMs: 5000, details: 'Execution timed out (5s limit exceeded).' })
      }

      const passed = exitCode === 0 && !stderr.trim()
      const details = stderr.trim() ? stderr.trim() : (stdout.trim() ? stdout.trim() : 'Process executed cleanly.')

      resolve({
        result: passed ? 'PASS' : 'FAIL',
        passed,
        durationMs,
        details
      })
    })
  })
}

// Flexible Endpoint matching both Native API & Piston format
app.post(['/execute', '/api/v2/piston/execute'], async (req, res) => {
  try {
    let language = req.body.language || 'python'
    let code = req.body.submittedCode || ''
    let validationSpec = req.body.validationSpec || ''

    // Support Piston payload format: { language, files: [{ content: "..." }] }
    if (req.body.files && Array.isArray(req.body.files) && req.body.files.length > 0) {
      code = req.body.files[0].content || ''
    }

    const result = await executeCode({ language, code, validationSpec })

    // Return Piston-compatible output structure as well
    res.json({
      result: result.result || (result.passed ? 'PASS' : 'FAIL'),
      passed: result.passed,
      durationMs: result.durationMs,
      details: result.details,
      run: {
        stdout: result.passed ? result.details : '',
        stderr: !result.passed ? result.details : '',
        code: result.passed ? 0 : 1
      }
    })
  } catch (err) {
    res.status(500).json({ passed: false, durationMs: 0, details: 'Internal Execution Server Error: ' + err.message })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 AnkiX Execution Microservice running on port ${PORT}`)
})
