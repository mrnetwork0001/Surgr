import React from 'react'
import { Composition } from 'remotion'
import { FPS, SURGR_DURATION, Surgr } from './Surgr'

export const RemotionRoot: React.FC = () => (
  <Composition id="Surgr" component={Surgr} durationInFrames={SURGR_DURATION} fps={FPS} width={1920} height={1080} />
)
