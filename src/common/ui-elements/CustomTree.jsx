import React, { Component } from 'react';
import 'react-sortable-tree/style.css';
import SortableTree from 'react-sortable-tree';
// import Loading from '../Loading';

class Tree extends Component {
  constructor() {
    super();
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
    this.setState({ treeData: this.props.treeData });
  }

  componentWillReceiveProps(next) {
    this.setState({ treeData: next.treeData });
  }

  render() {
    if (this.props.treeLoading) {
      return <p>Loading...</p>;
    }
    return (
      <div style={{ height: 500 }}>
        <SortableTree
          canDrag={false}
          treeData={this.state.treeData}
          onChange={(treeData) => this.setState({ treeData })}
          generateNodeProps={this.props.generateNodeProps}
        />
      </div>
    );
  }
}

export default Tree;
