import React from 'react';
import PropTypes from 'prop-types';
import ToggleContent from '../../common/ToggleContent/ToggleContent';
import Property from './Property';
import BoolProperty from './BoolProperty';
import NumericProperty from './NumericProperty';
import OptionProperty from './OptionProperty';
import TriggerProperty from './TriggerProperty';
import VecProperty from './VectorProperty';
import MatrixProperty from './MatrixProperty';
import styles from './../SceneGraphNode.scss';
import Button from '../../common/Input/Button/Button';
import DataManager from '../../../api/DataManager';
import { OriginKey } from '../../../api/keys';
import Icon from '../../common/Icon/Icon';
import Shortcut from './../Shortcut';

const types = {
  BoolProperty,
  OptionProperty,
  TriggerProperty,
  StringProperty: Property,
  NumericProperty,
  FloatProperty: NumericProperty,
  IntProperty: NumericProperty,
  Vec2Property: VecProperty,
  Vec3Property: VecProperty,
  Vec4Property: VecProperty,
  MatrixProperty,
  DMat4Property: MatrixProperty,
  defaultProperty: Property,
};

const getFocusButton = (isSceneGraphNode, identifier, subowners) => {
  if (isSceneGraphNode) {
    const focusButton =   <div className={styles.shycontainer}>
      <Button className={styles.shybutton} identifier={identifier} onClick={focusOnThis} >
        <Icon icon="gps_fixed" />
      </Button>
    </div>

    const bothButtons =   <div className={styles.shycontainer}>
      <Button className={styles.globeButton} identifier={identifier} onClick={gotoThis} >
        <Icon icon="language" />
      </Button>
       <Button className={styles.shybutton} identifier={identifier} onClick={focusOnThis} >
        <Icon icon="gps_fixed" />
      </Button>
    </div>

    var isGlobe = false;
    for (var i = 0; i < subowners.length; i++) {
      if (subowners[i].identifier == "RenderableGlobe") {
        isGlobe = true;
      }
    }
    //todo replace with isGlobe once we have a goto geo function that includes geo radius
    if (false) {
      return bothButtons;
    } else {
      return focusButton;
    }
  } else {
    return null
  }
}

const gotoThis = (e) => {
  e.stopPropagation();
  DataManager.setValue(OriginKey, '"' + e.currentTarget.getAttribute("identifier") + '"');
  const GotoGeoScript = 'openspace.globebrowsing.goToGeo(0, 0, 20000000)';
  DataManager.runScript(GotoGeoScript);
}

const focusOnThis = (e) => {
  e.stopPropagation();
  DataManager.setValue(OriginKey, e.currentTarget.getAttribute("identifier"));
}

const getTitle = (identifier, properties) => {
  var title = identifier;
  for (var i = 0; i < properties.length; i++) {
    if (properties[i].id  == "GuiName") {
        title = properties[i].Value;
    }
  }
  return title;
};

const getSubOwnerMarkup = (subowner) => {
  if (subowner.identifier) {
    if ( (subowner.subowners && subowner.subowners.length > 0) || (subowner.properties && subowner.properties.length > 0) )  {
      return <PropertyOwner {...subowner} key={subowner.identifier} />    
    } else {
      return "";
    }
  } else {
    return <Shortcut {...subowner} key={subowner.identifier} />
  }
};


const PropertyOwner = ({ identifier, properties, subowners, isSceneGraphNode }) => (  
  <ToggleContent headerChildren={getFocusButton(isSceneGraphNode, identifier, subowners)} title={getTitle(identifier,properties)}>
    { subowners.map(subowner => (
      getSubOwnerMarkup(subowner)
    )) }
    
    { properties.map((prop) => {
      const { Description } = prop;

      if ( Description.MetaData &&  (Description.MetaData.Visibility == "Hidden") ) {
        return;
      }
        
      const Type = types[Description.Type] || types.defaultProperty;
        return (
          <Type key={Description.Identifier} {...prop} subscribe />
        );
    }) }
  </ToggleContent>
);

PropertyOwner.propTypes = {
  identifier: PropTypes.string.isRequired,
  properties: PropTypes.arrayOf(PropTypes.object),
  subowners: PropTypes.arrayOf(PropTypes.shape({
    identifier: PropTypes.string,
    subowners: PropTypes.array,
    properties: PropTypes.array,
  })),
};

PropertyOwner.defaultProps = {
  properties: [],
  subowners: [],
};

export default PropertyOwner;
export const Types = types;
export const GetType = type => types[type] || types.defaultProperty;
