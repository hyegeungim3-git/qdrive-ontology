import type { SpaceId } from './meta'
import type { ChangeKind } from './impactmeta'

/**
 * 화면 사이 이동 + 프리셋.
 *
 * 「이 규칙을 고치자」는 제안이 ⑦ 영향 분석·④ 문법 검증으로 넘어갈 때, 그냥 화면만 열면
 * 사용자가 조건을 손으로 다시 맞춰야 한다. 넘어가는 쪽이 조건까지 들고 간다.
 */
export type StepId =
  | 'spaces'
  | 'grammar'
  | 'standards'
  | 'validator'
  | 'chain'
  | 'sim'
  | 'impact'
  | 'meta'
  | 'live'
  | 'quarantine'
  | 'export'

export type Preset = {
  validator?: { from: SpaceId; to: SpaceId; rel: string }
  impact?: { space: SpaceId; change: ChangeKind }
}

export type Jump = (step: StepId, preset?: Preset) => void
