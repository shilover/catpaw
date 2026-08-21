import ArcModeScene from './ArcModeScene.js';
import { makeSeededRandom, dailySeed, dailyKey } from '../utils/random.js';
import { FONT_FAMILY, HEADER_HEIGHT } from '../data/displayConfig.js';
import { t } from '../i18n/index.js';

// The same solo round as Arc Mode, with one difference that changes everything
// about it: the randomness comes from the date instead of Math.random. Every
// player gets the same species in the same order, at the same targets and the
// same places, all day — which is what makes comparing scores mean anything
// without a server to arbitrate.
export default class DailyChallengeScene extends ArcModeScene {
  constructor() {
    super('DailyChallenge');
  }

  get resultMode() {
    return 'daily';
  }

  createLaneRandom() {
    return makeSeededRandom(dailySeed());
  }

  create() {
    super.create();

    // Say which day's run this is, so a screenshot is self-identifying.
    this.add.text(16, HEADER_HEIGHT / 2, t('dailyBadge', { date: dailyKey() }), {
      fontFamily: FONT_FAMILY, fontSize: '15px', fontStyle: 'bold', color: '#ffd23f',
    }).setOrigin(0, 0.5).setDepth(50);
  }
}
