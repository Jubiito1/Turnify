import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('writes a header, rows and a UTF-8 BOM', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('﻿a,b\r\n1,x\r\n');
  });

  it('quotes commas, quotes and new lines', () => {
    expect(toCsv(['n'], [['Pérez, Juan "JP"\nOK']])).toBe('﻿n\r\n"Pérez, Juan ""JP""\nOK"\r\n');
  });

  it('neutralizes formula injection', () => {
    expect(toCsv(['n'], [['=HYPERLINK("http://x")'], ['+1'], ['@cmd']])).toBe(
      '﻿n\r\n"\'=HYPERLINK(""http://x"")"\r\n\'+1\r\n\'@cmd\r\n',
    );
  });

  it('renders null and undefined as empty cells', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toBe('﻿a,b\r\n,\r\n');
  });
});
