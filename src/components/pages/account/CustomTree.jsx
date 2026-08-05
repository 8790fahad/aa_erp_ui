/* eslint-disable no-unused-vars */
import React, { Component } from "react";
import PropTypes from "prop-types";
// import "react-sortable-tree/style.css";
// import SortableTree from "react-sortable-tree";
import "@nosferatu500/react-sortable-tree/style.css";

import SortableTree from "@nosferatu500/react-sortable-tree";

class CustomTree extends Component {
  constructor(props) {
    super(props);
    this.state = {
      treeData: [],
    };
  }

  static defaultProps = {
    treeData: [],
    generateNodeProps: (f) => f,
    treeLoading: false,
  };

  componentDidMount() {
    const expandedTreeData = this.expandFirstLevelChildren(this.props.treeData);
    this.setState({ treeData: expandedTreeData });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.treeData !== this.props.treeData) {
      const expandedTreeData = this.expandFirstLevelChildren(
        this.props.treeData
      );
      this.setState({ treeData: expandedTreeData });
    }
  }

  // shouldComponentUpdate(nextProps, nextState) {
  //   return (
  //     this.props.treeData !== nextProps.treeData ||
  //     this.state.treeData !== nextState.treeData
  //   );
  // }

  expandFirstLevelChildren(treeData) {
    return treeData.map((node) => ({
      ...node,
      expanded: false,
    }));
  }

  render() {
    if (this.props.treeLoading) {
      return <p>Loading...</p>;
    }

    return (
      <div style={{ height: 600 }}>
        <SortableTree
          canDrag={false}
          treeData={this.state.treeData}
          onChange={(treeData) => {
            this.setState({ treeData });
          }}
          generateNodeProps={this.props.generateNodeProps}
          isVirtualized={false}
          style={{ fontWeight: "lighter", font: "inherit" }}
        />
      </div>
    );
  }
}

CustomTree.propTypes = {
  treeData: PropTypes.array.isRequired,
  treeLoading: PropTypes.bool,
  generateNodeProps: PropTypes.func,
};

export default CustomTree;
