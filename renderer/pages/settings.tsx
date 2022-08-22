import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import Card from '../components/ui/card'
import Button from '../components/ui/button'

function Settings() {
  return (
    <React.Fragment>
        <div>
            <Card className='padbottom'>
                <h1>Current user</h1>

                <p>
                  Logged in as: user
                </p>

                <Button label="Logout user" className="btn-small"></Button>
            </Card>

            <Card className='padbottom'>
                <h1>xCloud</h1>

                <p>
                  xCloud settings
                </p>
            </Card>

            <Card className='padbottom'>
                <h1>xHomestreaming</h1>

                <p>
                  xHomestreaming settings
                </p>
            </Card>

            <Card className='padbottom'>
                <h1>Gamepad</h1>

                <p>
                  Gamepad settings
                </p>
            </Card>
        </div>
    </React.Fragment>
  );
};

export default Settings;
