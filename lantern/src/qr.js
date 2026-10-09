// A byte-mode QR code for the player link. No network call, so the DM screen
// can still show it when this browser is offline. Error correction is level M.

const ECC_M = 0;
const BLOCKS = {
  1: { ec: 10, groups: [[1, 16]] },
  2: { ec: 16, groups: [[1, 28]] },
  3: { ec: 26, groups: [[1, 44]] },
  4: { ec: 18, groups: [[2, 32]] },
  5: { ec: 24, groups: [[2, 43]] },
  6: { ec: 16, groups: [[4, 27]] },
  7: { ec: 18, groups: [[4, 31]] },
  8: { ec: 22, groups: [[2, 38], [2, 39]] },
  9: { ec: 22, groups: [[3, 36], [2, 37]] },
  10: { ec: 26, groups: [[4, 43], [1, 44]] },
};

const ALIGN = {
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

function mul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

const GENERATORS = new Map();

function generator(ec) {
  if (GENERATORS.has(ec)) return GENERATORS.get(ec);
  let poly = [1];
  for (let i = 0; i < ec; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  GENERATORS.set(ec, poly);
  return poly;
}

function remainder(data, gen) {
  const base = data.concat(new Array(gen.length - 1).fill(0));
  for (let i = 0; i < data.length; i += 1) {
    const factor = base[i];
    if (!factor) continue;
    for (let j = 0; j < gen.length; j += 1) base[i + j] ^= mul(gen[j], factor);
  }
  return base.slice(data.length);
}

function dataCapacity(version) {
  return BLOCKS[version].groups.reduce((sum, [count, len]) => sum + count * len, 0);
}

function pushBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function dataCodewords(text, version) {
  const bytes = new TextEncoder().encode(text);
  const cap = dataCapacity(version);
  const countBits = version <= 9 ? 8 : 16;
  if (bytes.length >= 2 ** countBits) return null;
  const bits = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, countBits);
  for (const byte of bytes) pushBits(bits, byte, 8);
  if (bits.length > cap * 8) return null;
  const terminator = Math.min(4, cap * 8 - bits.length);
  pushBits(bits, 0, terminator);
  while (bits.length % 8) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    out.push(value);
  }
  let pad = 0xec;
  while (out.length < cap) {
    out.push(pad);
    pad = pad === 0xec ? 0x11 : 0xec;
  }
  return out.length === cap ? out : null;
}

function chooseVersion(text) {
  for (let version = 1; version <= 10; version += 1) {
    if (dataCodewords(text, version)) return version;
  }
  return 0;
}

function interleave(codewords, version) {
  const spec = BLOCKS[version];
  const blocks = [];
  let offset = 0;
  const gen = generator(spec.ec);
  for (const [count, len] of spec.groups) {
    for (let i = 0; i < count; i += 1) {
      const data = codewords.slice(offset, offset + len);
      offset += len;
      blocks.push({ data, ecc: remainder(data, gen) });
    }
  }
  const out = [];
  const maxData = Math.max(...blocks.map((block) => block.data.length));
  for (let i = 0; i < maxData; i += 1) {
    for (const block of blocks) if (i < block.data.length) out.push(block.data[i]);
  }
  for (let i = 0; i < spec.ec; i += 1) {
    for (const block of blocks) out.push(block.ecc[i]);
  }
  return out;
}

function blank(size) {
  return Array.from({ length: size }, () => Array(size).fill(false));
}

function drawFinder(matrix, reserved, x, y) {
  const size = matrix.length;
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
      const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const edge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      matrix[yy][xx] = inside && (edge || core);
      reserved[yy][xx] = true;
    }
  }
}

function drawAlignment(matrix, reserved, cx, cy) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      matrix[cy + dy][cx + dx] = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
      reserved[cy + dy][cx + dx] = true;
    }
  }
}

function reserveFormat(reserved) {
  const size = reserved.length;
  for (let i = 0; i <= 8; i += 1) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
}

function reserveVersion(reserved) {
  const size = reserved.length;
  if (size < 45) return;
  for (let i = 0; i < 18; i += 1) {
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    reserved[b][a] = true;
    reserved[a][b] = true;
  }
}

function functionMatrix(version) {
  const size = 21 + 4 * (version - 1);
  const matrix = blank(size);
  const reserved = blank(size);
  drawFinder(matrix, reserved, 0, 0);
  drawFinder(matrix, reserved, size - 7, 0);
  drawFinder(matrix, reserved, 0, size - 7);
  for (let i = 0; i < size; i += 1) {
    if (!reserved[6][i]) {
      matrix[6][i] = i % 2 === 0;
      reserved[6][i] = true;
    }
    if (!reserved[i][6]) {
      matrix[i][6] = i % 2 === 0;
      reserved[i][6] = true;
    }
  }
  const centers = ALIGN[version] || [];
  for (const cx of centers) {
    for (const cy of centers) {
      if (reserved[cy][cx]) continue;
      drawAlignment(matrix, reserved, cx, cy);
    }
  }
  reserveFormat(reserved);
  reserveVersion(reserved);
  matrix[size - 8][8] = true;
  reserved[size - 8][8] = true;
  return { matrix, reserved };
}

function placeData(matrix, reserved, bytes) {
  const size = matrix.length;
  let bit = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (reserved[y][x]) continue;
        let on = false;
        if (bit < bytes.length * 8) {
          on = ((bytes[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
          bit += 1;
        }
        matrix[y][x] = on;
      }
    }
  }
}

function bitAt(value, index) {
  return ((value >>> index) & 1) === 1;
}

function formatBits(mask) {
  const data = (ECC_M << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >>> i) & 1) rem ^= 0b10100110111 << (i - 10);
  }
  return ((data << 10) | (rem & 0x3ff)) ^ 0b101010000010010;
}

function drawFormat(matrix, mask) {
  const bits = formatBits(mask);
  const size = matrix.length;
  const set = (x, y, index) => { matrix[y][x] = bitAt(bits, index); };
  for (let i = 0; i <= 5; i += 1) set(8, i, i);
  set(8, 7, 6);
  set(8, 8, 7);
  set(7, 8, 8);
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, i);
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, i);
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, i);
  matrix[size - 8][8] = true;
}

function versionBits(version) {
  let rem = version << 12;
  for (let i = 17; i >= 12; i -= 1) {
    if ((rem >>> i) & 1) rem ^= 0b1111100100101 << (i - 12);
  }
  return (version << 12) | (rem & 0xfff);
}

function drawVersion(matrix, version) {
  if (version < 7) return;
  const bits = versionBits(version);
  const size = matrix.length;
  for (let i = 0; i < 18; i += 1) {
    const on = bitAt(bits, i);
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    matrix[b][a] = on;
    matrix[a][b] = on;
  }
}

function maskFlips(pattern, row, col) {
  switch (pattern) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function penalty(matrix) {
  const size = matrix.length;
  let score = 0;
  const run = (get) => {
    for (let i = 0; i < size; i += 1) {
      let color = get(i, 0);
      let count = 1;
      for (let j = 1; j < size; j += 1) {
        const next = get(i, j);
        if (next === color) count += 1;
        else {
          if (count >= 5) score += 3 + (count - 5);
          color = next;
          count = 1;
        }
      }
      if (count >= 5) score += 3 + (count - 5);
    }
  };
  run((row, col) => matrix[row][col]);
  run((col, row) => matrix[row][col]);
  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const color = matrix[row][col];
      if (color === matrix[row][col + 1] && color === matrix[row + 1][col] && color === matrix[row + 1][col + 1]) {
        score += 3;
      }
    }
  }
  const finder = (line) => {
    const text = line.map((bit) => (bit ? "1" : "0")).join("");
    for (let i = 0; i <= text.length - 11; i += 1) {
      const slice = text.slice(i, i + 11);
      if (slice === "00001011101" || slice === "10111010000") score += 40;
    }
  };
  for (let i = 0; i < size; i += 1) {
    finder(matrix[i]);
    finder(matrix.map((row) => row[i]));
  }
  let dark = 0;
  for (const row of matrix) for (const bit of row) if (bit) dark += 1;
  const percent = Math.floor((dark * 100) / (size * size));
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

function applyMask(matrix, reserved, pattern) {
  const size = matrix.length;
  const next = matrix.map((row) => row.slice());
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (reserved[row][col]) continue;
      if (maskFlips(pattern, row, col)) next[row][col] = !next[row][col];
    }
  }
  return next;
}

export function qrMatrix(text) {
  const value = String(text ?? "");
  const version = chooseVersion(value);
  if (!version) throw new Error("That link is too long for a QR code.");
  const { matrix, reserved } = functionMatrix(version);
  placeData(matrix, reserved, interleave(dataCodewords(value, version), version));
  let best = null;
  let bestScore = Infinity;
  for (let pattern = 0; pattern < 8; pattern += 1) {
    const masked = applyMask(matrix, reserved, pattern);
    drawFormat(masked, pattern);
    drawVersion(masked, version);
    const score = penalty(masked);
    if (score < bestScore) {
      bestScore = score;
      best = masked;
    }
  }
  return best;
}

export function qrSvg(text) {
  const matrix = qrMatrix(text);
  const quiet = 4;
  const size = matrix.length + quiet * 2;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("role", "img");
  const paper = document.createElementNS(ns, "rect");
  paper.setAttribute("width", String(size));
  paper.setAttribute("height", String(size));
  paper.setAttribute("fill", "#f4efe6");
  svg.append(paper);
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix.length; x += 1) {
      if (!matrix[y][x]) continue;
      const cell = document.createElementNS(ns, "rect");
      cell.setAttribute("x", String(x + quiet));
      cell.setAttribute("y", String(y + quiet));
      cell.setAttribute("width", "1");
      cell.setAttribute("height", "1");
      cell.setAttribute("fill", "#14110e");
      svg.append(cell);
    }
  }
  return svg;
}
