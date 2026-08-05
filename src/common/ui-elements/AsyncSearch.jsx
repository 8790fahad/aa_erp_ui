import React, { useState } from "react";
import { Fragment } from "react";
import { AsyncTypeahead } from "react-bootstrap-typeahead";
import { Search } from "react-feather";
import { api_url } from "redux/actions";
import { checkStrEmpty } from "utils/index";

function AsyncSearch(props) {
  let [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState([]);

  const handleSearch = (query) => {
    setIsLoading(true);
    setSearchTerm(query);

    fetch(`${api_url}/search?type=${props.query_type}&&param=%${query}%`)
      .then((resp) => resp.json())
      .then((items) => {
        // console.log(items)
        // if (items.length === 1) {
        //   props.handleResult(searchTerm, items[0]);
        // } else {
        setOptions(items.results);
        // }

        setIsLoading(false);
      });
  };

  return (
    <div className="form-group has-search">
      <span className="form-control-feedback">
        <Search />
      </span>
      <AsyncTypeahead
        // ref={props._ref}
        id="search"
        isLoading={isLoading}
        labelKey={i => `${i.fullname} ${i.company_name || ''}`}
        minLength={1}
        onSearch={handleSearch}
        options={options}
        placeholder={props.placeholder || "Search..."}
        emptyLabel=""
        renderMenuItemChildren={(option, props) => (
          <Fragment>
            <div>
              <p className="font-weight-bold my-0">
              {!checkStrEmpty(option.fullname)
                ? option.fullname
                : option.company_name}{" "}
              ({option.customer_code})</p>
         
              <p className="font-weight-bold my-0">Type: {option.kyc_type}</p>
              {/* <p className="font-weight-bold mr-1">
                Location: {option.city}, {option.resident_state}
              </p> */}
            </div>
          </Fragment>
        )}
        onChange={(val) => {
          if (val.length) {
            props.handleResult(searchTerm, val[0]);
          }
        }}
        {...props}
      />
    </div>
  );
}

export default AsyncSearch;
