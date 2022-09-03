import Link from 'next/link'
import React from 'react'
import Button from '../ui/button'

interface AchievementRowProps {
  achievement;
}

function AchievementRow({
  achievement,
  ...props
}: AchievementRowProps) {
    
  if(achievement.isSecret == true)
    console.log(achievement)

  function drawProgression(achievement){
    const requirements = achievement.progression.requirements
    const progress = []

    if(achievement.progressState == 'Achieved'){
      return [
        <p>Unlocked</p>,
        <p>{achievement.rewards[0].value} G</p>,
      ]
    } else {
      progress.push((<p>Locked</p>))
    }

    for(const item in requirements){
      if(requirements[item].operationType.toLowerCase() == 'maximum' || requirements[item].operationType.toLowerCase() == 'sum'){
        // progress.push((<p>{requirements[item].current || 0}/{requirements[item].target}</p>))

      } else {
        return 'Unknown type:'+requirements[item].operationType
      }
    }

    return progress
  }

  function drawRewards(achievement){
    const rewards = []

    for(const item in achievement.rewards){
      if(achievement.rewards[item].type == 'Gamerscore'){
        rewards.push((<p>- Gamerscore: {achievement.rewards[item].value}</p>))
      } else {
        rewards.push((<p>- In-App Item: {achievement.rewards[item].name} ({achievement.rewards[item].value})</p>))
      }
    }

    return rewards
  }

  return (
    <React.Fragment>
      <div className='components_achievement_row'>
        <div>
            <img className='components_achievement_row_icon' src={ achievement.mediaAssets[0].url} />
        </div>

        <div>
            <p style={{ fontWeight: 200 }}>{achievement.name}</p>
            <p>{achievement.isSecret ? 'This is a secret...' : achievement.progressState == 'Achieved' ? achievement.description : achievement.lockedDescription}</p>

            <div className='components_achievement_row_rewards'>
              <p>Rewards:</p>
              { drawRewards(achievement) }
            </div>
        </div>

        <div className='components_achievement_row_right'>
          { drawProgression(achievement) }
        </div>
      </div>
    </React.Fragment>
  );
};

export default AchievementRow;
