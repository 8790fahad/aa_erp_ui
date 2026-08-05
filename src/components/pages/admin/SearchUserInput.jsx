import { _fetchApi } from "@/redux/actions/api";
import { useCallback, useEffect, useState } from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { useSelector } from "react-redux";

function SearchUserInput(props) {
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const getUsers = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/api/v1/get-users-by-facility/${activeBusiness.id}`,
      (data) => {
        setLoading(false);
        if (data.success) {
          //   alert(JSON.stringify(data.results));
          setUsersList(data.results);
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
      }
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const validOptions = usersList.filter(
    (opt) => opt && typeof opt.firstname === "string"
  );

  return (
    <>
      <Typeahead
        id="material-typeahead"
        disabled={props.disabled || loading}
        options={validOptions}
        className="z-100 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
        size={props.size || "sm"}
        isLoading={loading}
        placeholder="Select user"
        labelKey={(i) =>
          i && i.firstname ? `${i.firstname} - ${i.lastname}` : ""
        }
        onChange={(selectedItems) => {
          if (selectedItems.length > 0) {
            props.onChange(selectedItems[0]);
          }
        }}
        inputProps={{
          style: { borderColor: props.color, borderWidth: 2 },
        }}
        selected={props.selected ? [props.selected] : []}
        {...props}
      />
    </>
  );
}

export default SearchUserInput;
