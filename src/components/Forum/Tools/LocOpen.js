import React from "react";
import { specialFormatting } from "../../../widgets/authdb";
import WeatherCitySky from "../.././SwitchCity/WeatherCitySky";

class LocOpen extends React.Component {
  state = {
    new: "",
    queryCity: "",
    predictions: []
  };
  onSearchChange = async () => {
    const { typesA = ["(address)"] } = this.props;
    //const { typesE = ["(establishment)"] } = this.props;
    //console.log(input)
    const numberEntered = /^[\d]/;
    const letterEntered = /^[\W\D]/;
    const enteredValue = this.state.queryCity; //e.target.value;
    if (this.state.new !== this.state.queryCity) {
      this.setState({ new: this.state.queryCity });
      this.setState({ enteredValue, typesA });
      if (enteredValue && numberEntered.test(enteredValue)) {
        clearTimeout(this.timepout);
        this.timepout = setTimeout(async () => {
          await fetch(
            //`https://atlas.microsoft.com/search/address/json?subscription-key={sxQptNsgPsKENxW6a4jyWDWpg6hOQGyP1hSOLig4MpQ}&api-version=1.0&query=${enteredValue}&typeahead={typeahead}&limit={5}&language=en-US`
            //`https://api.mapbox.com/geocoding/v5/mapbox.places/${enteredValue}.json?limit=2&types=address&access_token=pk.eyJ1Ijoibmlja2NhcmR1Y2NpIiwiYSI6ImNrMWhyZ3ZqajBhcm8zY3BoMnVnbW02dXQifQ.aw4gJV_fsZ1GKDjaWPxemQ`
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${enteredValue}.json?limit=5&types=address&access_token=pk.eyJ1Ijoibmlja2NhcmR1Y2NpIiwiYSI6ImNrMWhyZ3ZqajBhcm8zY3BoMnVnbW02dXQifQ.aw4gJV_fsZ1GKDjaWPxemQ`
          )
            .then(async (response) => await response.json())
            .then(
              (body) => {
                this.setState({ predictions: body.features });
              },
              (err) => console.log(err)
            )
            .catch((err) => {
              console.log(err);
              this.setState({ city: "", address: "" });
              alert("please use a neighbor's address, none found");
            });
        });
      } else if (enteredValue && letterEntered.test(enteredValue)) {
        clearTimeout(this.timepout);
        this.timepout = setTimeout(async () => {
          await fetch(
            //`https://atlas.microsoft.com/search/address/json?subscription-key={sxQptNsgPsKENxW6a4jyWDWpg6hOQGyP1hSOLig4MpQ}&api-version=1.0&query=${enteredValue}&typeahead={typeahead}&limit={5}&language=en-US`
            //`https://api.mapbox.com/geocoding/v5/mapbox.places/${enteredValue}.json?limit=2&types=address&access_token=pk.eyJ1Ijoibmlja2NhcmR1Y2NpIiwiYSI6ImNrMWhyZ3ZqajBhcm8zY3BoMnVnbW02dXQifQ.aw4gJV_fsZ1GKDjaWPxemQ`
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${enteredValue}.json?limit=5&types=place&access_token=pk.eyJ1Ijoibmlja2NhcmR1Y2NpIiwiYSI6ImNrMWhyZ3ZqajBhcm8zY3BoMnVnbW02dXQifQ.aw4gJV_fsZ1GKDjaWPxemQ`
          )
            .then(async (response) => await response.json())
            .then(
              (body) => {
                this.setState({ predictions: body.features });
              },
              (err) => console.log(err)
            )
            .catch((err) => {
              console.log(err);
              this.setState({ city: "", address: "" });
              alert("please use a neighbor's address, none found");
            });
        });
      }
    }
  };
  render() {
    const { predictions } = this.state;
    return (
      <div
        style={{
          zIndex: "6",
          top: !this.props.locOpen || this.props.inBuy ? "0px" : "56px",
          display: "flex",
          position: "relative",
          transition: ".3s ease-in",
          width: "100%",
          height: !this.props.locOpen
            ? "0px"
            : this.props.inBuy
            ? "100%"
            : "calc(100% - 56px)",
          backgroundColor: "#844fff",
          wordWrap: "break-word",
          flexDirection: "column"
        }}
      >
        <form
          style={{
            display: "flex",
            position: "relative",
            zIndex: "9999",
            width: "100%",

            height: "56px"
          }}
          onSubmit={(e) => {
            e.preventDefault();
            this.onSearchChange();
          }}
        >
          <div onClick={this.props.closeLoc} className="randomheader" />
          <input
            className="Switch_CMap_Header"
            ref={this.textInput}
            name="city"
            placeholder="Try somewhere else"
            autoComplete="off"
            autoCorrect="off"
            value={this.state.queryCity}
            /*onChange={e => {
                    e.persist();
                    this.setState({loading:true})
                    this.evntHandler(e);
                  }}*/
            onChange={(e) =>
              this.setState({
                queryCity: specialFormatting(e.target.value)
              })
            }
            // onKeyPress="return event.keyCode != 13;"
          />
          <div
            style={{
              display: "flex",
              position: "fixed",
              boxSizing: "border-box",
              bottom: "0px",
              right: "0px",
              left: "0px",
              top: "56px",
              zIndex: "6000",
              width: "100%",
              transition: "transform 0.3s ease-out",
              overflowY: "auto",
              overflowX: "hidden"
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                position: "absolute",
                width: "100%",
                paddingBottom: "56px"
              }}
            >
              {this.state.queryCity !== ""
                ? predictions &&
                  predictions.length > 0 &&
                  this.state.queryCity === this.state.new
                  ? predictions.map((prediction) => (
                      <div key={prediction.place_name} className="onecity">
                        <div
                          onClick={() =>
                            this.props.choosePrediction(prediction)
                          }
                        >
                          <WeatherCitySky city={prediction} />
                        </div>
                        {prediction.place_name}
                      </div>
                    ))
                  : "no results"
                : null}
            </div>
          </div>
          {this.state.queryCity !== "" &&
          predictions &&
          predictions.length < 1 ? (
            <div className="topoffenter">Press enter to search for cities</div>
          ) : null}
          {this.state.new && this.state.new === this.state.queryCity ? (
            <div
              style={{
                position: "fixed",
                bottom: "0px",
                height: "56px",
                verticalAlign: "middle",
                backgroundColor: "white",
                zIndex: "9999",
                width: "max-content"
              }}
            >
              Search powered by{" "}
              <a href="http://mapbox.com/about/maps">
                <svg
                  viewBox="0 0 81 20"
                  style={{
                    color: "white",
                    width: "81px",
                    height: "20px",
                    verticalAlign: "middle"
                  }}
                >
                  <path
                    d={`${
                      "M9.07917722,0.0888888889 C4.06575949,0.0888888889 0,4.52222222 " +
                      "0,9.98888889 C0,15.4555556 4.06575949,19.8888889 9.07917722,19.8888889 " +
                      "C14.0925949,19.8888889 18.1583544,15.4555556 18.1583544,9.98888889 C18.1583544,4.52222222 " +
                      "14.0925949,0.0888888889 9.07917722,0.0888888889 Z M55.7284177,2.27777778 C55.6061392,2.27777778 " +
                      "55.5042405,2.38888889 55.5042405,2.52222222 L55.5042405,13.9888889 C55.5042405,14.1222222 " +
                      "55.6061392,14.2333333 55.7284177,14.2333333 L57.0938608,14.2333333 C57.2161392,14.2333333 " +
                      "57.318038,14.1222222 57.318038,13.9888889 L57.318038,13.2 C58.0211392,14 58.9891772,14.4555556 " +
                      "59.9979747,14.4555556 C62.1276582,14.4555556 63.8599367,12.4555556 63.8599367,9.97777778 " +
                      "C63.8599367,7.5 62.1276582,5.51111111 59.9979747,5.51111111 C58.9789873,5.51111111 " +
                      "58.0109494,5.96666667 57.318038,6.76666667 L57.318038,2.52222222 C57.318038,2.38888889 " +
                      "57.2161392,2.27777778 57.0938608,2.27777778 L55.7284177,2.27777778 Z M10.0166456,3.93333333 " +
                      "C11.1782911,3.96666667 12.3501266,4.46666667 13.2468354,5.45555556 C15.050443,7.42222222 " +
                      "15.1115823,10.5333333 13.3894937,12.4222222 C10.2815823,15.8111111 4.74848101,14.7222222 " +
                      "4.74848101,14.7222222 C4.74848101,14.7222222 3.74987342,8.68888889 6.85778481,5.3 C7.72392405,4.36666667 " +
                      "8.86518987,3.91111111 10.0166456,3.93333333 Z M26.3510127,5.51111111 C25.515443,5.51111111 " +
                      "24.7308228,5.95555556 24.231519,6.68888889 L24.231519,5.97777778 C24.231519,5.84444444 " +
                      "24.1296203,5.73333333 24.0073418,5.73333333 L22.6418987,5.73333333 C22.5196203,5.73333333 " +
                      "22.4177215,5.84444444 22.4177215,5.97777778 L22.4177215,14 C22.4177215,14.1333333 22.5196203,14.2444444 " +
                      "22.6418987,14.2444444 L24.0073418,14.2444444 C24.1296203,14.2444444 24.231519,14.1333333 24.231519,14 " +
                      "L24.231519,9.2 C24.2824684,8.12222222 24.9651899,7.27777778 25.8007595,7.27777778 C26.6668987,7.27777778 " +
                      "27.3903797,8.06666667 27.3903797,9.11111111 L27.3903797,14 C27.3903797,14.1333333 27.4922785,14.2444444 " +
                      "27.614557,14.2444444 L28.9901899,14.2444444 C29.1124684,14.2444444 29.2143671,14.1333333 29.2143671,14 " +
                      "L29.2041772,9.01111111 C29.3264557,8.03333333 29.9786076,7.27777778 30.7632278,7.27777778 " +
                      "C31.6293671,7.27777778 32.3528481,8.06666667 32.3528481,9.11111111 L32.3528481,14 C32.3528481,14.1333333 " +
                      "32.4547468,14.2444444 32.5770253,14.2444444 L33.9526582,14.2444444 C34.0749367,14.2444444 34.1768354,14.1333333 " +
                      "34.1768354,14 L34.1666456,8.48888889 C34.1972152,6.84444444 32.9132911,5.51111111 31.3236709,5.51111111 " +
                      "C30.3046835,5.52222222 29.3672152,6.16666667 28.9290506,7.17777778 C28.419557,6.14444444 27.4311392,5.5 " +
                      "26.3510127,5.51111111 L26.3510127,5.51111111 Z M39.3838608,5.51111111 C37.2541772,5.51111111 " +
                      "35.5218987,7.51111111 35.5218987,9.98888889 C35.5218987,12.4666667 37.2541772,14.4666667 39.3838608,14.4666667 " +
                      "C40.4028481,14.4666667 41.3708861,14.0111111 42.0637975,13.2111111 L42.0637975,14 C42.0637975,14.1333333 " +
                      "42.1656962,14.2444444 42.2879747,14.2444444 L43.6534177,14.2444444 C43.7756962,14.2444444 43.8775949,14.1333333 " +
                      "43.8775949,14 L43.8775949,5.97777778 C43.8877848,5.84444444 43.7858861,5.73333333 43.6534177,5.73333333 " +
                      "L42.2879747,5.73333333 C42.1656962,5.73333333 42.0637975,5.84444444 42.0637975,5.97777778 L42.0637975,6.76666667 " +
                      "C41.3606962,5.96666667 40.3926582,5.51111111 39.3838608,5.51111111 Z M50.1953165,5.51111111 C49.1763291,5.51111111 " +
                      "48.2082911,5.96666667 47.5153797,6.76666667 L47.5153797,5.97777778 C47.5153797,5.84444444 47.413481,5.73333333 " +
                      "47.2912025,5.73333333 L45.9257595,5.73333333 C45.803481,5.73333333 45.7015823,5.84444444 45.7015823,5.97777778 " +
                      "L45.7015823,17.4444444 C45.7015823,17.5777778 45.803481,17.6888889 45.9257595,17.6888889 L47.2912025,17.6888889 " +
                      "C47.413481,17.6888889 47.5153797,17.5777778 47.5153797,17.4444444 L47.5153797,13.2 C48.218481,14 " +
                      "49.186519,14.4555556 50.1953165,14.4555556 C52.325,14.4555556 54.0572785,12.4555556 54.0572785,9.97777778 " +
                      "C54.0572785,7.5 52.325,5.51111111 50.1953165,5.51111111 Z M69.0975316,5.51111111 C66.7844304,5.51111111 " +
                      "64.9196835,7.51111111 64.9196835,9.98888889 C64.9196835,12.4666667 66.7946203,14.4666667 69.0975316,14.4666667 " +
                      "C71.400443,14.4666667 73.2753797,12.4666667 73.2753797,9.98888889 C73.2753797,7.51111111 71.4106329,5.51111111 " +
                      "69.0975316,5.51111111 Z M73.7237342,5.73333333 C73.6116456,5.73333333 73.5199367,5.83333333 73.5199367,5.95555556 " +
                      "C73.5199367,6 73.5301266,6.04444444 73.5505063,6.07777778 L75.8941772,9.96666667 L73.5199367,13.9 C73.4587975,14 " +
                      "73.4791772,14.1444444 73.5810759,14.2111111 C73.6116456,14.2333333 73.6524051,14.2444444 73.6931646,14.2444444 " +
                      "L75.2725949,14.2444444 C75.3948734,14.2444444 75.506962,14.1777778 75.5681013,14.0666667 L76.9743038,11.5 " +
                      "L78.3805063,14.0666667 C78.4416456,14.1777778 78.5537342,14.2444444 78.6760127,14.2444444 L80.255443,14.2444444 " +
                      "C80.3675316,14.2444444 80.4592405,14.1444444 80.4592405,14.0222222 C80.4592405,13.9777778 80.4490506,13.9444444 " +
                      "80.4286709,13.9 L78.0544304,9.96666667 L80.3981013,6.07777778 C80.4592405,5.97777778 80.4388608,5.83333333 " +
                      "80.336962,5.76666667 C80.3063924,5.74444444 80.2656329,5.73333333 80.2248734,5.73333333 L78.645443,5.73333333 " +
                      "C78.5231646,5.73333333 78.4110759,5.8 78.3499367,5.91111111 L76.9743038,8.43333333 L75.5986709,5.91111111 " +
                      "C75.5375316,5.8 75.425443,5.73333333 75.3031646,5.73333333 L73.7237342,5.73333333 Z M10.1185443,5.88888889 " +
                      "L9.23202532,7.88888889 L7.40803797,8.85555556 L9.23202532,9.82222222 L10.1185443,11.8222222 L11.0152532,9.82222222 " +
                      "L12.8392405,8.85555556 L11.0152532,7.88888889 L10.1185443,5.88888889 Z M39.6997468,7.3 C40.9938608,7.3 " +
                      "42.0434177,8.48888889 42.0637975,9.95555556 L42.0637975,10.0222222 C42.0536076,11.4888889 40.9938608,12.6777778 " +
                      "39.6997468,12.6777778 C38.395443,12.6777778 37.3356962,11.4777778 37.3356962,9.98888889 C37.3356962,8.5 38.395443,7.3 " +
                      "39.6997468,7.3 L39.6997468,7.3 Z M49.8692405,7.3 C51.1735443,7.3 52.2332911,8.5 52.2332911,9.98888889 " +
                      "C52.2332911,11.4777778 51.1735443,12.6777778 49.8692405,12.6777778 C48.5751266,12.6777778 47.5255696,11.4888889 " +
                      "47.5051899,10.0222222 L47.5051899,9.95555556 C47.5255696,8.48888889 48.5751266,7.3 49.8692405,7.3 L49.8692405,7.3 Z " +
                      "M59.6820886,7.3 C60.9863924,7.3 62.0461392,8.5 62.0461392,9.98888889 C62.0461392,11.4777778 60.9863924,12.6777778 " +
                      "59.6820886,12.6777778 C58.3879747,12.6777778 57.3384177,11.4888889 57.318038,10.0222222 L57.318038,9.95555556 " +
                      "C57.3384177,8.48888889 58.3879747,7.3 59.6820886,7.3 L59.6820886,7.3 Z M69.0771519,7.3 C70.3814557,7.3 71.4412025,8.5 " +
                      "71.4412025,9.98888889 C71.4412025,11.4777778 70.3814557,12.6777778 69.0771519,12.6777778 C67.7728481,12.6777778 " +
                      "66.7131013,11.4777778 66.7131013,9.98888889 C66.7131013,8.5 67.7728481,7.3 69.0771519,7.3 Z"
                    }`}
                    id="Shape"
                  />
                </svg>
              </a>
              <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>
            </div>
          ) : null}
          {/*<img src={powered} className="pwrGoogle" alt="error" />*/}
        </form>
      </div>
    );
  }
}
export default LocOpen;
