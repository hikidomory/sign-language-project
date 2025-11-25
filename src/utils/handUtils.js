// src/utils/handUtils.js

// 랜드마크를 [x, y] 배열로 변환
export function toXY(lm) {
  return lm.map((p) => [p.x, p.y]);
}

// 벡터 정규화
const norm = (v) => {
  const n = Math.hypot(v[0], v[1]) + 1e-8;
  return [v[0] / n, v[1] / n];
};

// 세 점 사이의 각도 계산
function angleBetween(p1, p2, p3) {
  const a = [p1[0] - p2[0], p1[1] - p2[1]];
  const b = [p3[0] - p2[0], p3[1] - p2[1]];
  const an = norm(a), bn = norm(b);
  const dot = an[0] * bn[0] + an[1] * bn[1];
  const cross = an[0] * bn[1] - an[1] * bn[0];
  let ang = Math.atan2(cross, dot);
  if (ang < 0) ang += 2 * Math.PI;
  return ang;
}

// 손가락 관절 3개의 각도 계산
function angleFingerJoint(w, p1, p2, p3, p4) {
  return [
    angleBetween(w, p1, p2),
    angleBetween(p1, p2, p3),
    angleBetween(p2, p3, p4),
  ];
}

// 손 크기 계산 (정규화용)
function getHandSize(coords) {
  const xs = coords.map((p) => p[0]);
  const ys = coords.map((p) => p[1]);
  const dx = Math.max(...xs) - Math.min(...xs);
  const dy = Math.max(...ys) - Math.min(...ys);
  return Math.hypot(dx, dy);
}

// 두 점 사이의 유클리드 거리 (손 크기로 나눔)
function euclideanDistance(a, b, handSize) {
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  return handSize ? d / handSize : 0.0;
}

// 손 방향 각도
function handOrientationAngle(coords) {
  const wrist = coords[0];
  const middle = coords[9];
  return Math.atan2(middle[1] - wrist[1], middle[0] - wrist[0]);
}

// ★ 핵심: 22개 특징 추출 함수
export function extractFeatures(coords) {
  const features = [];
  const J = [
    [0, 1, 2, 3, 4],   // 엄지
    [0, 5, 6, 7, 8],   // 검지
    [0, 9, 10, 11, 12], // 중지
    [0, 13, 14, 15, 16], // 약지
    [0, 17, 18, 19, 20], // 소지
  ];

  // 1. 5개 손가락 x 3개 관절 각도 = 15 features
  for (const [w, p1, p2, p3, p4] of J) {
    features.push(...angleFingerJoint(coords[w], coords[p1], coords[p2], coords[p3], coords[p4]));
  }
  
  // 2. 엄지-검지 각도 = 1 feature
  features.push(angleBetween(coords[4], coords[0], coords[8]));

  const handSize = getHandSize(coords);
  const tips = [4, 8, 12, 16, 20];
  const distances = [];

  // 3. 손가락 끝 사이 4개 거리 = 4 features
  for (let i = 0; i < tips.length - 1; i++) {
    const d = euclideanDistance(coords[tips[i]], coords[tips[i + 1]], handSize);
    distances.push(d);
    features.push(d);
  }

  // 4. 거리 비율 = 1 feature
  features.push(distances[1] ? distances[0] / distances[1] : 0.0);

  // 5. 손 방향 = 1 feature
  features.push(handOrientationAngle(coords));

  return features; // 총 22개
}

// ... (기존 extractFeatures 등 위쪽 코드 유지) ...

// ✅ [추가] Holistic 모델용 데이터 추출 함수 (Python 코드 1_collect_data.py와 동일 로직)
export function extractHolisticFeatures(results) {
  // 1. Pose (33개 포인트 * 4값(x,y,z,vis)) = 132개
  const pose = results.poseLandmarks 
    ? results.poseLandmarks.flatMap(p => [p.x, p.y, p.z, p.visibility])
    : new Array(33 * 4).fill(0);

  // 2. Left Hand (21개 포인트 * 3값(x,y,z)) = 63개
  const lh = results.leftHandLandmarks
    ? results.leftHandLandmarks.flatMap(p => [p.x, p.y, p.z])
    : new Array(21 * 3).fill(0);

  // 3. Right Hand (21개 포인트 * 3값(x,y,z)) = 63개
  const rh = results.rightHandLandmarks
    ? results.rightHandLandmarks.flatMap(p => [p.x, p.y, p.z])
    : new Array(21 * 3).fill(0);

  // 순서대로 합치기: Pose + Left + Right = 258개
  return [...pose, ...lh, ...rh];
}