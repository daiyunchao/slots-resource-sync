/**
 * 解析版本号，支持格式如 v885
 * @param {string} version - 版本号字符串
 * @returns {object} - {prefix: 'v', number: 885}
 */
export function parseVersion(version) {
  const match = version.match(/^([a-zA-Z]*)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}. Expected format: v123 or 123`);
  }

  return {
    prefix: match[1] || '',
    number: parseInt(match[2], 10)
  };
}

/**
 * 计算版本号减去指定偏移量
 * @param {string} version - 原始版本号，如 v885
 * @param {number} offset - 偏移量，默认2
 * @returns {string} - 新版本号，如 v883
 */
export function decrementVersion(version, offset = 2) {
  const { prefix, number } = parseVersion(version);
  const newNumber = number - offset;

  if (newNumber < 0) {
    throw new Error(`Version calculation resulted in negative number: ${version} - ${offset} = ${newNumber}`);
  }

  return `${prefix}${newNumber}`;
}

/**
 * 验证版本号格式
 * @param {string} version - 版本号
 * @returns {boolean}
 */
export function validateVersion(version) {
  try {
    parseVersion(version);
    return true;
  } catch {
    return false;
  }
}
