import Link from 'next/link'
import React from 'react'
import Button from '../ui/button'

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
          <p>{achievement.currentGamerscore}/{achievement.maxGamerscore} G</p>
          <p>{achievement.earnedAchievements} unlocked</p>
        </div>
      </div>
    </React.Fragment>
  );
};

export default AchievementGameRow;
