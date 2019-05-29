/*
 * Copyright 2019 resin.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-magic-numbers */

'use strict'

// eslint-disable-next-line no-unused-vars
const React = require('react')
const propTypes = require('prop-types')
const {
  ChangeButton,
  DetailsText,
  StepButton,
  StepNameButton,
  ThemedProvider
} = require('./../../styled-components')
const { Txt } = require('rendition')
const middleEllipsis = require('./../../utils/middle-ellipsis')
const { bytesToClosestUnit } = require('./../../../../shared/units')

const TargetSelector = (props) => {
  const targets = props.selection.getSelectedDrives()

  let buttonTemplate = props.show && (
    <div>
      <StepButton
        tabindex={(targets.length > 0) ? -1 : 2 }
        disabled={props.disabled}
        onClick={props.openDriveSelector}
      >
        Select drive
      </StepButton>
    </div>
  )

  if (targets.length === 1) {
    const target = targets[0]
    buttonTemplate = (
      <div>
        <StepNameButton
          plain
          tooltip={props.tooltip}
        >
          {/* eslint-disable no-magic-numbers */}
          { middleEllipsis(target.description, 20) }
        </StepNameButton>
        <DetailsText>
          { props.constraints.hasListDriveImageCompatibilityStatus(targets, props.image) &&
            <Txt.span className='glyphicon glyphicon-exclamation-sign'
              ml={2}
              tooltip={
                props.constraints.getListDriveImageCompatibilityStatuses(targets, props.image)[0].message
              }
            />
          }
          {bytesToClosestUnit(target.size)}
        </DetailsText>
        { !props.flashing &&
          <ChangeButton
            plain
            onClick={props.reselectDrive}
          >
            Change
          </ChangeButton>
        }
      </div>
    )
  }

  if (targets.length > 1) {
    const targetsTemplate = []
    for (const target of targets) {
      targetsTemplate.push((
        <DetailsText
          key={target.device}
          tooltip={`${target.description} ${target.displayName}`}
        >
          { middleEllipsis(target.description, 14) }
        </DetailsText>
      ))
    }
    buttonTemplate = (
      <div>
        <StepNameButton
          plain
          tooltip={props.tooltip}
        >
          {targets.length} Targets
        </StepNameButton>
        { !props.flashing &&
          <ChangeButton
            plain
            onClick={props.reselectDrive}
            height={21}
            mb={15}
          >
            Change
          </ChangeButton>
        }
        {targetsTemplate}
      </div>
    )
  }

  return (
    <ThemedProvider>
      {buttonTemplate}
    </ThemedProvider>
  )
}

TargetSelector.propTypes = {
  disabled: propTypes.bool,
  openDriveSelector: propTypes.func,
  selection: propTypes.object,
  reselectDrive: propTypes.func,
  flashing: propTypes.bool,
  constraints: propTypes.object,
  show: propTypes.bool,
  tooltip: propTypes.string
}

module.exports = TargetSelector
