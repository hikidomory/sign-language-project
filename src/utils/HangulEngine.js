// src/utils/HangulEngine.js

// --- 상수 데이터 ---
export const CHOSUNG = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
export const JUNGSUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
export const JONGSUNG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ls","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

const START_CODE = 44032; // '가'
const END_CODE = 55203;   // '힣'

// 겹받침 분해 규칙
const DOUBLE_CONSONANT_DECOMPOSITION = {
  ㄲ: ["ㄱ", "ㄱ"], ㄸ: ["ㄷ", "ㄷ"], ㅃ: ["ㅂ", "ㅂ"], ㅆ: ["ㅅ", "ㅅ"], ㅉ: ["ㅈ", "ㅈ"],
};
const VOWEL_DECOMPOSITION = {
  ㅘ: ["ㅗ", "ㅏ"], ㅙ: ["ㅗ", "ㅐ"], ㅚ: ["ㅗ", "ㅣ"], ㅝ: ["ㅜ", "ㅓ"], ㅞ: ["ㅜ", "ㅔ"], ㅟ: ["ㅜ", "ㅣ"], ㅢ: ["ㅡ", "ㅣ"],
};
const JONGSUNG_DECOMPOSITION = {
  ㄳ: ["ㄱ", "ㅅ"], ㄵ: ["ㄴ", "ㅈ"], ㄶ: ["ㄴ", "ㅎ"], ㄺ: ["ㄹ", "ㄱ"], ㄻ: ["ㄹ", "ㅁ"],
  ㄼ: ["ㄹ", "ㅂ"], ㄽ: ["ㄹ", "ㅅ"], ㄾ: ["ㄹ", "ㅌ"], ㄿ: ["ㄹ", "ㅍ"], ㅀ: ["ㄹ", "ㅎ"], ㅄ: ["ㅂ", "ㅅ"],
};

// --- 1. 텍스트 -> 자모 분해 (Text2Sign용) ---
export function tokenize(text) {
  const tokens = [];
  
  const pushToken = (key, raw) => {
    // 분해 규칙 확인
    if (DOUBLE_CONSONANT_DECOMPOSITION[key]) {
      DOUBLE_CONSONANT_DECOMPOSITION[key].forEach(c => tokens.push({ key: c, raw: raw }));
    } else if (VOWEL_DECOMPOSITION[key]) {
      VOWEL_DECOMPOSITION[key].forEach(v => tokens.push({ key: v, raw: raw }));
    } else if (JONGSUNG_DECOMPOSITION[key]) {
      JONGSUNG_DECOMPOSITION[key].forEach(c => tokens.push({ key: c, raw: raw }));
    } else {
      tokens.push({ key: key, raw: raw });
    }
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);

    if (char === " ") {
      tokens.push({ key: "space", raw: " " });
      continue;
    }

    if (code >= START_CODE && code <= END_CODE) {
      const diff = code - START_CODE;
      const jongIdx = diff % 28;
      const jungIdx = ((diff - jongIdx) / 28) % 21;
      const choIdx = Math.floor((diff - jongIdx) / 28 / 21);

      pushToken(CHOSUNG[choIdx], char);
      pushToken(JUNGSUNG[jungIdx], char);
      if (jongIdx > 0) {
        pushToken(JONGSUNG[jongIdx], char);
      }
    } else {
      // 한글이 아니면 그대로 (숫자 등)
      pushToken(char.toLowerCase(), char);
    }
  }
  return tokens;
}

// --- 2. 자모 -> 텍스트 조합 (Cam2Text용) ---

// 자음/모음 판별
export const isConsonant = (label) => "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".includes(label);
export const isVowel = (label) => "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ".includes(label);

// 조합 규칙 맵
const COMBINE_CHO = { ㄱ: { ㄱ: "ㄲ" }, ㄷ: { ㄷ: "ㄸ" }, ㅂ: { ㅂ: "ㅃ" }, ㅅ: { ㅅ: "ㅆ" }, ㅈ: { ㅈ: "ㅉ" } };
const COMBINE_JUNG = { ㅗ: { ㅏ: "ㅘ", ㅐ: "ㅙ", ㅣ: "ㅚ" }, ㅜ: { ㅓ: "ㅝ", ㅔ: "ㅞ", ㅣ: "ㅟ" }, ㅡ: { ㅣ: "ㅢ" } };
const COMBINE_JONG = {
  ㄱ: { ㅅ: "ㄳ" }, ㄴ: { ㅈ: "ㄵ", ㅎ: "ㄶ" },
  ㄹ: { ㄱ: "ㄺ", ㅁ: "ㄻ", ㅂ: "ㄼ", ㅅ: "ㄽ", ㅌ: "ㄾ", ㅍ: "ㄿ", ㅎ: "ㅀ" },
  ㅂ: { ㅅ: "ㅄ" },
};

// 초성/중성/종성 합쳐서 글자 만들기
export function composeHangul(cho, jung, jong) {
  if (!cho || !jung) return null;
  const choIdx = CHOSUNG.indexOf(cho);
  const jungIdx = JUNGSUNG.indexOf(jung);
  const jongIdx = JONGSUNG.indexOf(jong || "");
  
  if (choIdx < 0 || jungIdx < 0 || jongIdx < 0) return null;
  return String.fromCharCode(START_CODE + choIdx * 588 + jungIdx * 28 + jongIdx);
}

// 글자를 다시 자모로 쪼개기 (백스페이스용)
export function decomposeHangul(char) {
  const code = char.charCodeAt(0);
  if (code < START_CODE || code > END_CODE) return null;
  const diff = code - START_CODE;
  const jongIdx = diff % 28;
  const jungIdx = ((diff - jongIdx) / 28) % 21;
  const choIdx = Math.floor((diff - jongIdx) / 28 / 21);
  return {
    cho: CHOSUNG[choIdx],
    jung: JUNGSUNG[jungIdx],
    jong: jongIdx > 0 ? JONGSUNG[jongIdx] : null,
  };
}

// ★ 상태 머신: 새로운 자모가 들어왔을 때 상태 변화 처리
export function processJamoInput(newJamo, currentState, commitCallback) {
  let { cho, jung, jong } = currentState;
  let nextState = { ...currentState };

  // 1. 아무것도 없는 상태
  if (!cho && !jung && !jong) {
    if (isConsonant(newJamo)) nextState.cho = newJamo;
    else if (isVowel(newJamo)) nextState.jung = newJamo; // 모음 단독
    return nextState;
  }

  // 2. 초성만 있는 상태
  if (cho && !jung) {
    if (isVowel(newJamo)) {
      nextState.jung = newJamo; // 초성+모음 합체
    } else {
      // 자음+자음 (겹초성 시도: ㄱ+ㄱ=ㄲ)
      const combined = COMBINE_CHO[cho]?.[newJamo];
      if (combined) {
        nextState.cho = combined;
      } else {
        commitCallback(cho); // 앞 글자 확정
        nextState = { cho: newJamo, jung: null, jong: null }; // 새 글자 시작
      }
    }
    return nextState;
  }

  // 3. 초성+중성 있는 상태
  if (cho && jung && !jong) {
    if (isConsonant(newJamo)) {
      nextState.jong = newJamo; // 받침으로 들어감
    } else {
      // 모음+모음 (겹모음 시도: ㅗ+ㅏ=ㅘ)
      const combined = COMBINE_JUNG[jung]?.[newJamo];
      if (combined) {
        nextState.jung = combined;
      } else {
        commitCallback(composeHangul(cho, jung, null)); // 앞 글자 확정
        nextState = { cho: null, jung: newJamo, jong: null };
      }
    }
    return nextState;
  }

  // 4. 종성까지 있는 상태
  if (cho && jung && jong) {
    if (isConsonant(newJamo)) {
      // 겹받침 시도
      const combined = COMBINE_JONG[jong]?.[newJamo];
      if (combined) {
        nextState.jong = combined;
      } else {
        commitCallback(composeHangul(cho, jung, jong));
        nextState = { cho: newJamo, jung: null, jong: null };
      }
    } else {
      // ★ 종성 뒤에 모음이 오면 뒤로 넘기기 (연음 법칙: 각+ㅏ -> 가+카)
      // 겹받침 분해 (앉 -> ㄴ, ㅈ)
      const pair = JONGSUNG_DECOMPOSITION[jong];
      if (pair) {
        commitCallback(composeHangul(cho, jung, pair[0])); // 앞 받침 확정
        nextState = { cho: pair[1], jung: newJamo, jong: null }; // 뒷 받침은 다음 글자 초성으로
      } else {
        // 홑받침 분해
        commitCallback(composeHangul(cho, jung, null));
        nextState = { cho: jong, jung: newJamo, jong: null };
      }
    }
    return nextState;
  }

  return nextState;
}