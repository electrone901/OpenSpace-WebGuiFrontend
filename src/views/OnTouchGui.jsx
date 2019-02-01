import React, { Component } from 'react';
import { withRouter, HashRouter as Router, Route, Link } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import '../styles/base.scss';
import Sidebar from '../components/Sidebar/Sidebar';
import BottomBar from '../components/BottomBar/BottomBar';
import Error from '../components/common/Error/Error';
import Overlay from '../components/common/Overlay/Overlay';
import About from './About/About';
import Stack from '../components/common/Stack/Stack';

import {
  changePropertyValue, startConnection, fetchData, addStoryTree, startListening,
  addStoryInfo, resetStoryInfo,
} from '../api/Actions';
import TouchBar from '../components/TouchBar/TouchBar';
import styles from './OnTouchGui.scss';
import { traverseTreeWithURI } from '../utils/propertyTreeHelpers';
import {
  infoIconKey, ValuePlaceholder, OriginKey, StoryIdentifierKey,
  ApplyRemoveTagKey, ApplyAddTagKey, FocusNodesListKey, defaultStory,
  OverlimitKey, ScaleKey, ZoomInLimitKey,
} from '../api/keys';
import Slider from '../components/ImageSlider/Slider';
import { UpdateDeltaTimeNow } from '../utils/timeHelpers';
import { toggleShading, toggleHighResolution, toggleHidePlanet, toggleGalaxies, toggleZoomOut,
  resetBoolProperty, setStoryStart, hideDevInfoOnScreen, showDistanceOnScreen } from '../utils/storyHelpers';
import DeveloperMenu from '../components/TouchBar/UtilitiesMenu/presentational/DeveloperMenu';
import { isCompatible,
         formatVersion,
         RequiredSocketApiVersion,
         RequiredOpenSpaceVersion } from '../api/Version';

const KEYCODE_D = 68;

class OnTouchGui extends Component {
  constructor(props) {
    super(props);
    this.checkedVersion = false;
    this.state = {
      developerMode: false,
      currentStory: defaultStory
    };

    this.changeStory = this.changeStory.bind(this);
    this.setStory = this.setStory.bind(this);
    this.resetStory = this.resetStory.bind(this);
    this.checkStorySettings = this.checkStorySettings.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.toggleDeveloperMode = this.toggleDeveloperMode.bind(this);
  }

  componentDidMount() {
    this.props.StartConnection();
    this.props.FetchData(infoIconKey);

    document.addEventListener('keydown', this.handleKeyPress);

    hideDevInfoOnScreen(true);
    showDistanceOnScreen(false);
  }

  checkVersion() {
    if (!this.checkedVersion && this.props.version.isInitialized) {
      const versionData = this.props.version.data;
      if (!isCompatible(
        versionData.openSpaceVersion, RequiredOpenSpaceVersion))
      {
        console.warn(
          'Possible incompatibility: \nRequired OpenSpace version: ' +
          formatVersion(RequiredOpenSpaceVersion) +
          '. Currently controlling OpenSpace version ' +
          formatVersion(versionData.openSpaceVersion) + '.'
        );
      }
      if (!isCompatible(
        versionData.socketApiVersion, RequiredSocketApiVersion))
      {
        console.warn(
          "Possible incompatibility: \nRequired Socket API version: " +
          formatVersion(RequiredSocketApiVersion) +
          ". Currently operating over API version " +
          formatVersion(versionData.socketApiVersion) + '.'
        );
      }
      this.checkedVersion = true;
    }
  }

  componentDidUpdate() {
    if (!storyIdentifierNode) return;

    const { storyIdentifierNode, story } = this.props;

    if (storyIdentifierNode.length !== 0) {
      if (storyIdentifierNode.Value.charAt(0) === '"') {
        storyIdentifierNode.Value = storyIdentifierNode.Value.substring(1, storyIdentifierNode.length - 1);
      }
      if (storyIdentifierNode.Value.charAt(storyIdentifierNode.length - 1) === '"') {
        storyIdentifierNode.Value = storyIdentifierNode.Value.substring(0, storyIdentifierNode.length - 1);
      }
      if (storyIdentifierNode.listeners === 0) {
        this.props.StartListening(StoryIdentifierKey);
        this.props.StartListening(FocusNodesListKey);
      }
      if (storyIdentifierNode.Value !== story.storyidentifier) {
//        if (storyIdentifierNode.Value.length !== 0 || story.storyidentifier.length !== 0) {
//        this.addStoryTree(storyIdentifierNode.Value);
        this.addStoryTree(story.storyidentifier);
//        }
      }
    }
    if (this.props.reset) {
      UpdateDeltaTimeNow(1);
      this.setStory('');
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyPress);
  }

  setStory(selectedStory) {
    if (selectedStory === '') {
      this.setState({ currentStory: defaultStory });
      return;
    }
    this.setState({ currentStory: selectedStory });

    const {
      storyIdentifierNode, applyRemoveTag, focusNodesList, applyAddTag, focusNode, overViewNode,
    } = this.props;

    // Check if the selected story is different from the OpenSpace property value
    if (storyIdentifierNode.Value !== selectedStory) {
      const json = this.addStoryTree(selectedStory);

      // If the previous story was the default there is no tags to remove
      if (storyIdentifierNode.Value !== defaultStory) {
        this.props.ChangePropertyValue(applyRemoveTag.Description, '');
      }

      // If the current story is the default - hide distance info on screen
      if (selectedStory === defaultStory) {
        showDistanceOnScreen(false);
      }
      else {
        showDistanceOnScreen(true);
      }

      // Set all the story specific properties
      this.props.ChangePropertyValue(storyIdentifierNode.Description, selectedStory);
      this.props.ChangePropertyValue(focusNodesList.Description, json.focusbuttons);
      this.props.ChangePropertyValue(applyAddTag.Description, '');
      this.props.ChangePropertyValue(focusNode.Description, json.start.planet);
      this.props.ChangePropertyValue(overViewNode.Description, json.overviewlimit);
      setStoryStart(json.start.location, json.start.time);

      // Check settings of the previous story and reset values
      this.checkStorySettings(this.props.story, 'true');
      // Check and set the settings of the current story
      this.checkStorySettings(json, 'false');

      // If the previous story scaled planets reset value
      if (this.props.story.scaleplanets) {
        this.props.scaleNodes.forEach((planet) => {
          this.props.ChangePropertyValue(planet.Description, 1);
        });
      }
      // If the previous story toggled bool properties reset them to default value
      if (this.props.story.toggleboolproperties) {
        this.props.story.toggleboolproperties.forEach((property) => {
          resetBoolProperty(property.URI, property.defaultvalue);
        });
      }
    }
  }

  resetStory () {
    this.setStory('');
  }

  checkStorySettings(story, value) {
    const oppositeValue = (value === 'true') ? 'false' : 'true';

    if (story.hideplanets) {
      story.hideplanets.forEach(planet => toggleHidePlanet(planet, value));
    }
    if (story.highresplanets) {
      story.highresplanets.forEach(planet => toggleHighResolution(planet, oppositeValue));
    }
    if (story.noshadingplanets) {
      story.noshadingplanets.forEach(planet => toggleShading(planet, value));
    }
    if (story.galaxies) {
      toggleGalaxies(oppositeValue);
    }
    if (story.inzoomlimit) {
      const zoomLimit = (value === 'true') ? '0' : story.inzoomlimit;
      this.props.ChangePropertyValue(this.props.zoomInNode.Description, zoomLimit);
    }
    if (story.zoomout) {
      toggleZoomOut(oppositeValue);
    }
  }

  // Read in json-file for new story and add it to redux
  addStoryTree(selectedStory) {
    const json = require(`../stories/story_${selectedStory}.json`);

    this.props.AddStoryTree(json);

    if (json.infofile) {
      const info = require(`../stories/${json.infofile}.json`);
      this.props.AddStoryInfo(info);
    } else {
      this.props.ResetStoryInfo();
    }
    return json;
  }

  changeStory(e) {
    this.setStory(e.target.id);
  }

  handleKeyPress(e) {
    if (e.keyCode === KEYCODE_D) {
      this.toggleDeveloperMode();
    }
  }

  toggleDeveloperMode() {
    this.setState({ developerMode: !this.state.developerMode });

    if (this.state.developerMode === true) {
      hideDevInfoOnScreen(false);
    } else {
      hideDevInfoOnScreen(true);
    }
  }

  render() {
    return (
      <div className={styles.app}>

        {<Router basename="/ontouch/">
          <Route
            path="/about"
            render={() => (
              <Overlay>
                <Stack style={{ maxWidth: '500px' }}>
                  <Link style={{ alignSelf: 'flex-end', color: 'white' }} to="/">
                    Close
                  </Link>
                  <About />
                </Stack>
              </Overlay>
            )}
          />
        </Router>}

        { this.props.connectionLost && (
          <Overlay>
            <Error>
              Connection lost. Trying to reconnect again soon.
            </Error>
          </Overlay>
        )}
        {this.state.developerMode &&
          <DeveloperMenu
            changeStory={this.changeStory}
            storyIdentifier={this.props.storyIdentifierNode.Value}
          />}
        <p className={styles.storyTitle}> {this.props.story.storytitle} </p>
        {(this.state.currentStory !== defaultStory)
          ? <TouchBar resetStory={this.resetStory} /> : <Slider changeStory={this.setStory} />
        }
       
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  let storyIdentifierNode = [];
  let applyRemoveTag = [];
  let applyAddTag = [];
  let focusNodesList = [];
  let focusNode;
  let overViewNode;
  let zoomInNode;
  const scaleNodes = [];
  const story = state.storyTree.story;

  if (Object.keys(state.propertyTree).length !== 0) {
    storyIdentifierNode = traverseTreeWithURI(state.propertyTree, StoryIdentifierKey);
    applyRemoveTag = traverseTreeWithURI(state.propertyTree, ApplyRemoveTagKey);
    applyAddTag = traverseTreeWithURI(state.propertyTree, ApplyAddTagKey);
    focusNodesList = traverseTreeWithURI(state.propertyTree, FocusNodesListKey);
    focusNode = traverseTreeWithURI(state.propertyTree, OriginKey);
    overViewNode = traverseTreeWithURI(state.propertyTree, OverlimitKey);
    zoomInNode = traverseTreeWithURI(state.propertyTree, ZoomInLimitKey);

    if (story.scaleplanets) {
      story.scaleplanets.planets.forEach((node) => {
        //scaleNodes.push(traverseTreeWithURI(state.propertyTree, ScaleKey.replace(ValuePlaceholder, `${node}`)));
        let foundScaleNode = traverseTreeWithURI(state.propertyTree, ScaleKey.replace(ValuePlaceholder, `${node}`));
        if (foundScaleNode) {
          scaleNodes.push(foundScaleNode);
        }
      });
    }
  }

  return {
    applyRemoveTag,
    applyAddTag,
    focusNodesList,
    storyIdentifierNode,
    connectionLost: state.connection.connectionLost,
    story,
    reset: state.storyTree.reset,
    focusNode,
    overViewNode,
    zoomInNode,
    scaleNodes,
  };
};

const mapDispatchToProps = dispatch => ({
  ChangePropertyValue: (discription, URI) => {
    dispatch(changePropertyValue(discription, URI));
  },
  StartConnection: () => {
    dispatch(startConnection());
  },
  FetchData: (id) => {
    dispatch(fetchData(id));
  },
  AddStoryTree: (story) => {
    dispatch(addStoryTree(story));
  },
  AddStoryInfo: (info) => {
    dispatch(addStoryInfo(info));
  },
  ResetStoryInfo: () => {
    dispatch(resetStoryInfo());
  },
  StartListening: (URI) => {
    dispatch(startListening(URI));
  },
});



OnTouchGui = withRouter(connect(
  mapStateToProps,
  mapDispatchToProps,
)(OnTouchGui));

OnTouchGui.propTypes = {
  StartConnection: PropTypes.func,
  FetchData: PropTypes.func,
  ChangePropertyValue: PropTypes.func,
  StartListening: PropTypes.func,
  AddStoryTree: PropTypes.func,
  AddStoryInfo: PropTypes.func,
  ResetStoryInfo: PropTypes.func,
  storyIdentifierNode: PropTypes.objectOf(PropTypes.shape({})),
  story: PropTypes.objectOf(PropTypes.shape({})),
  applyRemoveTag: PropTypes.objectOf(PropTypes.shape({})),
  applyAddTag: PropTypes.objectOf(PropTypes.shape({})),
  focusNodesList: PropTypes.objectOf(PropTypes.shape({})),
  focusNode: PropTypes.objectOf(PropTypes.shape({})),
  overViewNode: PropTypes.objectOf(PropTypes.shape({})),
  zoomInNode: PropTypes.objectOf(PropTypes.shape({})),
  scaleNodes: PropTypes.objectOf(PropTypes.shape({})),
  connectionLost: PropTypes.bool,
  reset: PropTypes.bool,
};

OnTouchGui.defaultProps = {
  StartConnection: () => {},
  FetchData: () => {},
  ChangePropertyValue: () => {},
  StartListening: () => {},
  AddStoryTree: () => {},
  AddStoryInfo: () => {},
  ResetStoryInfo: () => {},
  storyIdentifierNode: {},
  story: {},
  applyRemoveTag: {},
  applyAddTag: {},
  focusNodesList: {},
  focusNode: {},
  overViewNode: {},
  zoomInNode: {},
  scaleNodes: {},
  connectionLost: null,
  reset: null,
};

export default OnTouchGui;