import Link from 'next/link'
import React from 'react'
import Button from '../ui/button'
import ProgressBar from '../ui/progressbar'

interface SidebarFriendItemProps {
  achievement;
}

function AchievementGameRow({
  achievement,
  ...props
}: SidebarFriendItemProps) {
  console.log(achievement)

  return (
    <React.Fragment>
      <div className='components_achievement_gamerow'>
        <div>
          <Link href={ '/achievements/'+achievement.titleId }>
            {achievement.name}
          </Link>
        </div>

        <div className='components_achievement_gamerow_right'>
          <ProgressBar value={ (achievement.currentGamerscore/achievement.maxGamerscore)*100 }>{achievement.currentGamerscore}/{achievement.maxGamerscore}</ProgressBar>

          <p style={{ textAlign: 'center' }}>
            {achievement.earnedAchievements} 🏆
          </p>
        </div>
      </div>
    </React.Fragment>
  );
};

export default AchievementGameRow;
