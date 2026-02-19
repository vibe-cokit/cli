import { test, expect } from 'bun:test'
import { findBugBlock } from '../src/utils/keyboard'

const DELETE_TOKEN_BEFORE = 'deleteToken' + 'Before'

const LEGACY_BINARY_BLOCK =
  `if(!EH.backspace&&!EH.delete&&s.includes("\\x7F")){let XH=(s.match(/\\x7f/g)||[]).length,WH=j;${DELETE_TOKEN_BEFORE}(s);if(!j.equals(WH)){if(j.text!==WH.text)$(WH.text);z(WH.offset)}return}`

const NEW_LAYOUT_BINARY_BLOCK =
  `if (!EH.backspace && !EH.delete && s.includes("\\u007F")) { const XH=(s.match(/\\x7F/g)||[]).length; WH=j; ${DELETE_TOKEN_BEFORE}(s); if(!j.equals(WH)){if(j.text!==WH.text)$(WH.text); z(WH.offset)} return }`

test('findBugBlock finds legacy binary block', () => {
  const content = `xx${LEGACY_BINARY_BLOCK}yy`
  const result = findBugBlock(content, 'binary')

  expect(result.block).toContain(DELETE_TOKEN_BEFORE)
  expect(result.block).toContain('includes("\\x7F")')
})

test('findBugBlock finds new binary layout with unicode pattern', () => {
  const content = `aa${NEW_LAYOUT_BINARY_BLOCK}bb`
  const result = findBugBlock(content, 'binary')

  expect(result.block).toContain('includes("\\u007F")')
  expect(result.block).toContain(DELETE_TOKEN_BEFORE)
})

test('findBugBlock skips non-patchable blocks without legacy delete-token helper', () => {
  const unsupported =
    'if(!EH.backspace&&!EH.delete&&s.includes("\\x7F")){let XH=(s.match(/\\x7f/g)||[]).length,WH=j;if(!j.equals(WH)){if(j.text!==WH.text)$(WH.text);z(WH.offset)}return}'

  expect(() => findBugBlock(unsupported, 'binary')).toThrow()
})

test('findBugBlock handles spaced if syntax', () => {
  const spaced =
    `if  ( !EH.backspace && !EH.delete && s.includes("\\x7F") ) { let XH=(s.match(/\\x7f/g)||[]).length,WH=j;${DELETE_TOKEN_BEFORE}(s);if(!j.equals(WH)){if(j.text!==WH.text)$(WH.text);z(WH.offset)}return }`

  const result = findBugBlock(spaced, 'binary')
  expect(result.block).toContain(DELETE_TOKEN_BEFORE)
})
