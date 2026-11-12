// 文字の基準座標を「分割方法」と完全に独立して算出する。
// 文・文節・文字の各モードは、同じ文字スロットをどの単位で動かすかだけが異なる。

export function flattenCharacters(phrase) {
  return phrase.words.flatMap(word => word.characters);
}

export function groupIntoUnits(phrase, split) {
  if (split === "文") {
    return [{ id: phrase.id, startTime: phrase.startTime, characters: flattenCharacters(phrase) }];
  }
  if (split === "文節") {
    return phrase.words.map(word => ({
      id: word.id, startTime: word.startTime, characters: word.characters
    }));
  }
  return flattenCharacters(phrase).map(char => ({
    id: char.id, startTime: char.startTime, characters: [char]
  }));
}

// measureGlyph は各フォントの canvas.measureText を使う。
// すべての分割方法が同一の座標を使用するので、グループ境界に余白は生じない。
export function layoutCharacters(phrase, { writing, fontSize, maxWidth, maxHeight, measureGlyph }) {
  const chars = flattenCharacters(phrase);
  const slots = new Map();
  const safeWidth = Math.max(1, maxWidth);
  const safeHeight = Math.max(1, maxHeight);

  if (writing === "縦") {
    // 文字を1つずつ上から下へ積む。英数字・記号も回転させず直立させる。
    // 縦組みで右側が欠けやすいフォントのため、字枠は文字サイズより広く取る。
    const advanceY = fontSize * 1.28;
    const columnWidth = fontSize * 1.48;
    const columns = [[]];
    let columnHeight = 0;
    for (const char of chars) {
      if (columns.at(-1).length && columnHeight + advanceY > safeHeight) {
        columns.push([]);
        columnHeight = 0;
      }
      columns.at(-1).push(char);
      columnHeight += advanceY;
    }
    const height = Math.max(advanceY, ...columns.map(col => col.length * advanceY));
    const width = Math.max(columnWidth, columns.length * columnWidth);
    columns.forEach((column, colIndex) => {
      const x = (columns.length - colIndex - 1) * columnWidth;
      column.forEach((char, rowIndex) => {
        slots.set(char.id, { x, y: rowIndex * advanceY, width: columnWidth, height: advanceY });
      });
    });
    return { slots, width, height, scale: Math.min(1, safeWidth / width, safeHeight / height) };
  }

  const lineHeight = fontSize * 1.52;
  const rows = [[]];
  let rowWidth = 0;
  for (const char of chars) {
    // 和文・欧文・空白の本来の字幅を維持する。分割境界には gap を足さない。
    const advance = Math.max(fontSize * 0.18, measureGlyph(char.text));
    if (rows.at(-1).length && rowWidth + advance > safeWidth) {
      rows.push([]);
      rowWidth = 0;
    }
    rows.at(-1).push({ char, advance });
    rowWidth += advance;
  }
  const width = Math.max(1, ...rows.map(row => row.reduce((sum, item) => sum + item.advance, 0)));
  const height = Math.max(lineHeight, rows.length * lineHeight);
  rows.forEach((row, rowIndex) => {
    const widthOfRow = row.reduce((sum, item) => sum + item.advance, 0);
    let x = (width - widthOfRow) / 2;
    row.forEach(({ char, advance }) => {
      slots.set(char.id, { x, y: rowIndex * lineHeight, width: advance, height: lineHeight });
      x += advance;
    });
  });
  return { slots, width, height, scale: Math.min(1, safeWidth / width, safeHeight / height) };
}
