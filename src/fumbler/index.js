import React from "react";
import firebase from "firebase/app";
import "firebase/firestore";
import rsa from "js-crypto-rsa";

const standardCatch = (err) => console.log(err.message);
const arrayMessage = (message) =>
  message
    .toLowerCase()
    //capture or, excluding set, match 2 or more of the preceding token
    .replace(/((\r\n|\r|\n)+[^a-zA-Z]+_+[ ]{2,})+/g, " ")
    .split(" ");
const specialFormatting = (x, numbersOk) =>
  x
    .toLowerCase()
    //replace or regex a-z or A-Z includes space whitespace
    .replace(!numbersOk ? /[^a-zA-Z,']+/g : /[^a-zA-Z0-9,']+/g, " ")
    .split(" ")
    .map((word) => {
      var end = word.substring(1);
      if (word.includes("'")) {
        var withapos = word.lastIndexOf("'");
        var beginning = word.substring(1, withapos);
        if (beginning.length === 1) {
          end =
            beginning +
            "'" +
            word.charAt(withapos + 1).toUpperCase() +
            word.substring(withapos + 2);
        }
      }
      var resword = word.charAt(0).toUpperCase() + end;
      return ["Of", "And", "The"].includes(resword)
        ? resword.toLowerCase()
        : arrayMessage(resword).join(" ");
    })
    .join(" ");

class Vintages extends React.Component {
  constructor(props) {
    super(props);
    this.state = { keyBoxes: [], devices: [] };
  }
  castFirestoreBox = async (
    deviceBox,
    deviceName,
    userDatas,
    devices,
    authorId,
    user,
    vintage,
    rsaPrivateKeys
  ) => {
    devices
      .where("authorId", "==", authorId)
      .get()
      .then(async (devs) => {
        if ((devs && devs.docs.length === 0) || !user.key) {
          rsaPrivateKeys
            .deleteKey(deviceBox)
            .then(
              async () =>
                await rsaPrivateKeys.setPrivateKey({
                  _id: authorId,
                  box: deviceBox.box,
                  key: deviceBox.key,
                  vintage
                })
            )
            .catch(standardCatch);
        } else {
          console.log("casting box");
          console.log(deviceBox);
          if (
            !user.pendingDeviceBoxes[vintage] ||
            !user.pendingDeviceBoxes[vintage].includes(deviceBox.box)
          ) {
            return await userDatas
              .update({
                ["pendingDeviceBoxes" +
                vintage]: firebase.firestore.FieldValue.arrayUnion(
                  deviceBox.box
                )
              })
              .then(
                async () =>
                  await devices
                    .add({
                      authorId,
                      box: deviceBox.box,
                      name: deviceName,
                      vintage
                    })
                    .then(() => "awaitingAuthMode")
                    .catch(standardCatch)
              )
              .catch(standardCatch);
          } else return console.log("box is already pending approval");
        }
      });
  };

  getKeys = async (
    deviceBox,
    accountBox,
    user,
    userDatas, //userdata doc
    devices,
    deviceName,
    authorId,
    vintage,
    rsaPrivateKeys
  ) => {
    if (user["deviceBox" + deviceBox.box]) {
      await rsaPrivateKeys
        .setPrivateKey({
          _id: authorId,
          key: rsa.decrypt(
            user["deviceBox" + deviceBox.box],
            deviceBox.key,
            "SHA-256",
            {
              name: "RSA-PSS"
            }
          ),
          box: user.box,
          vintage
        })
        .then(
          async () =>
            await userDatas
              .update({
                ["pendingDeviceBoxes" +
                vintage]: firebase.firestore.FieldValue.arrayRemove(
                  accountBox.box
                ),
                ["deviceBox" +
                deviceBox.box]: firebase.firestore.FieldValue.delete()
              })
              .then(
                async () =>
                  await devices
                    .where("authorId", "==", authorId)
                    .where("box.n", "==", deviceBox.box.n)
                    .get()
                    .then((querySnapshot) => {
                      let foos = [];
                      let p = 0;
                      querySnapshot.docs.forEach((doc) => {
                        p++;
                        if (doc.exists) {
                          var foo = doc.data();
                          foo.id = doc.id;
                          foos.push(foo);
                        }
                      });
                      return (
                        querySnapshot.docs.length === p &&
                        devices
                          .doc(foos[foos.length].id)
                          .update({
                            authorized: true
                          })
                          .catch(standardCatch)
                      );
                    })
                    .catch(standardCatch)
              )
              .catch(standardCatch)
        );
    } /*else
      await castFirestoreBox(
        deviceBox,
        deviceName,
        userDatas,
        devices,
        authorId,
        user,
        rsaPrivateKeys,
        vintage
      );*/ //this shouldn't run unless interrupted
  };
  getDevices = (user, userDatas, accountBox, vintage) =>
    user.pendingDeviceBoxes[vintage] &&
    user.pendingDeviceBoxes[vintage].length > 0 &&
    user.pendingDeviceBoxes[vintage].map(
      async (deviceBox) =>
        await userDatas
          .update({
            ["pendingDeviceBoxes" +
            vintage]: firebase.firestore.FieldValue.arrayRemove(accountBox.box),
            ["deviceBox" + deviceBox]: rsa.encrypt(
              accountBox.key,
              deviceBox,
              "SHA-256",
              {
                name: "RSA-PSS"
              }
            )
          })
          .then(() => {})
          .catch(standardCatch)
    );

  saveDevice = async (
    user,
    userProps,
    deviceName,
    userDatas,
    devices,
    authorId,
    device,
    vintage,
    rsaPrivateKeys
  ) =>
    await rsa
      .generateKey(2048)
      .then(async (accountBox) => {
        console.log("fashioned keys");
        console.log(accountBox);
        const keybox = {
          _id: device ? "device" : authorId,
          key: accountBox.privateKey,
          box: accountBox.publicKey,
          vintage
        };
        console.log("saving");
        console.log(keybox);
        //with device-box, get account-key
        if (!userProps.box) {
          console.log("totally new account-box");
          //& device-box (same for first device)
          user
            .update({ box: keybox.box }) //keys are only on device
            .then(() =>
              console.log(
                "Establishing an original keybox for your account... success!  " +
                  "Now you can copy this to access on-device, end-to-end encrypted chats"
              )
            )
            .catch(standardCatch);
          await devices
            .add({
              authorId,
              box: keybox.box,
              name: deviceName
            })
            .then(() => "awaitingAuthMode")
            .catch(standardCatch);
        } else {
          console.log("adding as an additional device");
          await this.castFirestoreBox(
            keybox,
            specialFormatting(deviceName),
            userDatas,
            devices,
            authorId,
            user,
            vintage,
            rsaPrivateKeys
          );
        }
        return await rsaPrivateKeys.setPrivateKey(keybox);
        //randomString(4, "aA#")
      })
      .catch(standardCatch);

  fumbler = async (
    user,
    userDatas,
    devices,
    deviceName,
    authorId,
    vintage,
    rsaPrivateKeys
  ) => {
    if (!(user && userDatas && devices && deviceName && authorId && vintage)) {
      console.log(`REACT-FUMBLER: requires ...[
      userDocRef,
      userDatasDocRef,
      devicesCollectionRef,
      deviceName[String],
      authorId[auth.uid],
      vintage[partition for content:default desc[0]]] but got:`);
      return console.log([
        user,
        userDatas,
        devices,
        deviceName,
        authorId,
        vintage
      ]);
    }
    return await user.get().then(async (bar) => {
      var userProps = bar.data();
      userProps.id = bar.id;
      userDatas.get().then((barr) => {
        var userDatasProps = barr.data();
        userDatasProps.id = barr.id;
        if (
          !userDatasProps.vintages ||
          !userDatasProps.vintages.includes(vintage)
        )
          userDatas
            .update({
              vintages: firebase.firestore.FieldValue.arrayUnion(vintage),
              defaultVintage: vintage
            })
            .catch(standardCatch);
      });
      await rsaPrivateKeys
        .readPrivateKeys()
        .then(async (keysOutput) => {
          console.log(keysOutput);
          var keyBoxes = Object.values(keysOutput);
          if (keyBoxes) {
            keyBoxes = keyBoxes.map((x) => {
              if (!x.box || !x.key) {
                rsaPrivateKeys.deleteKey(x);
                return null;
              }
              return x;
            });
            console.log(keyBoxes);
            const accountBox = keyBoxes.find(
              (x) => x._id === authorId && vintage === x.vintage
            );
            devices
              .where("authorId", "==", authorId)
              .where("vintage", "==", vintage)
              .get()
              .then(async (devs) => {
                if (accountBox) {
                  //user keyBox found (locally), and useable. Everytime, salt the
                  //account-key stored on device for all pendingDeviceBoxes
                  //syncPending
                  console.log("found account box");
                  console.log(accountBox);
                  this.getDevices(userProps, userDatas, accountBox, vintage);
                  //async await require stringify? if already then'd,
                  //it is already object

                  //hydrate keys
                  const output = {
                    accountBox,
                    fumblingComplete: true,
                    devices: devs.docs
                      .map((doc) => {
                        if (doc.exists) {
                          var foo = doc.data();
                          foo.id = doc.id;
                          if (foo.name !== deviceName) {
                            foo.name = deviceName;
                            devices.doc(foo.id).update({ name: deviceName });
                          }
                          return foo;
                        } else return null;
                      })
                      .filter((x) => x)
                  };
                  return await new Promise((resolve) =>
                    resolve(JSON.stringify(output))
                  );
                } else {
                  const deviceBox = keyBoxes.find(
                    (x) => x._id === "device" && vintage === x.vintage
                  );
                  if (deviceBox) {
                    //no user keyBox found (locally), but device-box has been
                    //provisioned/forged (locally). Next,
                    console.log("found device box");
                    console.log(deviceBox);
                    this.getKeys(
                      deviceBox,
                      accountBox,
                      userProps,
                      userDatas,
                      devices,
                      deviceName,
                      authorId,
                      vintage,
                      rsaPrivateKeys
                    );
                    return null;
                  } else if (userProps.box || devs.docs.length === 0) {
                    return this.saveDevice(
                      user,
                      userProps,
                      deviceName,
                      userDatas,
                      devices,
                      authorId,
                      devs.docs.length > 0,
                      vintage,
                      rsaPrivateKeys
                    );
                  } else
                    devices
                      .where("authorId", "==", authorId)
                      .get()
                      .then((querySnapshot) => {
                        querySnapshot.docs.forEach((doc) => {
                          if (doc.exists) {
                            devices
                              .doc(doc.id)
                              .delete()
                              .then(() => {})
                              .catch(standardCatch);
                          }
                        });
                        keyBoxes.forEach((x) => rsaPrivateKeys.deleteKey(x));
                      });
                }
              });
          } /* else saveDevice(
            user,
            userProps,
            rsaPrivateKeys,
            deviceName,
            userDatas,
            devices,
            authorId
          );*/
        })
        .catch(standardCatch);
    });
  };
  updateMyKeys = async (room, user, rsaPrivateKeys) => {
    await rsaPrivateKeys
      .readPrivateKeys()
      .then(async (keysOutput) => {
        const keyBoxes = Object.values(keysOutput);
        var keyBox = keyBoxes.find((x) => x._id === room.id);
        if (keyBox) {
          const saltedKeys = room["saltedKeys" + this.props.authorId];
          saltedKeys &&
            rsa
              .decrypt(saltedKeys, user.key, "SHA-256", {
                name: "RSA-PSS"
              })
              .then(async (privateRoomKey) => {
                if (keyBox.key !== privateRoomKey) {
                  const keyBoxConfirmed = await rsaPrivateKeys.setPrivateKey({
                    _id: room.id,
                    key: keyBox.key,
                    box: room.box,
                    vintage: keyBox.vintage
                  });
                  keyBoxConfirmed &&
                    console.log("keyBox established locally for " + room.id);
                } else
                  console.log(
                    "there is a keyBox already registered for " + room.id
                  );
              });
        } else {
          //add saltedKey to pouchDB (local-storage)
        }
      })
      .catch((err) => console.log(err.message));
  };
  roomKeys = async (room, recipientsProfiled, rooms, user, rsaPrivateKeys) => {
    //same: room, or recipients && entityType + entityId
    if (room.publicRoomKey) {
      this.updateMyKeys(rsaPrivateKeys, room, user);
    } else {
      //new: room, or new recipients (or threadId from entity)
      return await rsa.generateKey(2048).then(async (roomBox) => {
        if (
          await rsaPrivateKeys.setPrivateKey({
            _id: room.id,
            key: roomBox.key,
            box: roomBox.box,
            vintage: roomBox.vintage
          })
        ) {
          return Promise.all(
            recipientsProfiled.map(
              (user) =>
                new Promise((resolve, reject) => {
                  const saltedKey = room["saltedKeys" + user.id];

                  if (saltedKey) {
                    resolve(saltedKey); //String
                  } else {
                    const saltedKey = rsa.encrypt(
                      roomBox.key,
                      user.box,
                      "SHA-256",
                      {
                        name: "RSA-PSS"
                      }
                    );
                    saltedKey && resolve(user.id + saltedKey);
                  }
                })
            )
          ).then((saltedKeys) => {
            let p = 0;
            var rm = { ...room };
            saltedKeys.map((out, p) => {
              p++;
              const user = recipientsProfiled.find((x) => out.startsWith(x.id));
              return (rm["saltedKeys" + user.id] =
                user && out.substring(user.id.length, out.length));
            });
            delete rm.id;
            rm.box = roomBox.box;
            if (p === saltedKeys.length) rooms.doc(room.id).update(rm);
          });
        }
      });
    }
  };

  deleteFumbledKeys = (keybox, devices, rsaPrivateKeys) => {
    rsaPrivateKeys
      .readPrivateKeys()
      .then(async (keysOutput) => {
        const keyBoxes = Object.values(keysOutput);
        var keyboxResult = keyBoxes.find((x) => x.box === keybox.box);
        if (keyboxResult)
          devices
            .doc(keybox.id)
            .delete()
            .then(() =>
              rsaPrivateKeys
                .deleteKey(keyboxResult)
                .then(() => {
                  console.log("deleted plan from local " + keybox.id);
                  //this.getNotes();
                })
                .catch(standardCatch)
            )
            .catch(standardCatch);
      })
      .catch(standardCatch);
  };
  devName = () =>
    this.props.ddb
      .readDeviceName()
      .then((prenotes) => {
        const deviceName = Object.values(prenotes)[0];
        if (deviceName) {
          this.setState({ deviceName: deviceName._id }, () => this.queryKeys());
        }
      })
      .catch((err) => console.log(err));
  componentDidMount = () => {
    this.props.ddb && setTimeout(() => this.devName(), 400);
  };
  findKeys = async (vintage) => {
    this.props.rsaPrivateKeys.readPrivateKeys().then(async (keysOutput) => {
      const keyBoxes = Object.values(keysOutput);
      if (keyBoxes)
        this.setState(
          { keyBoxes },
          () =>
            this.props.auth !== undefined &&
            this.props
              .deviceCollection()
              .where("authorId", "==", this.props.auth.uid)
              .get()
              .then(async (querySnapshot) => {
                let devices = [];
                let p = 0;
                const deviceBox = keyBoxes.find(
                  (x) => x._id === "device" && vintage === x.vintage
                );
                const accountBox = keyBoxes.find(
                  (x) => x._id === this.props.auth.uid && vintage === x.vintage
                );
                querySnapshot.docs.forEach((doc) => {
                  p++;
                  if (doc.exists) {
                    var dev = doc.data();
                    dev.id = doc.id;
                    //thisacc = user.pendingDeviceBoxes.find(x=>x.n===dev.box.n)
                    if (deviceBox) dev.deviceBox = deviceBox;
                    if (accountBox) dev.accountBox = accountBox;
                    if (dev.decommissioned) {
                      var keybox = keyBoxes.find((x) => x.box.n === dev.box.n);
                      if (keybox)
                        this.props.rsaPrivateKeys
                          .deleteKey(keybox)
                          .catch(standardCatch);
                    } else devices.push(dev);
                  }
                });
                if (querySnapshot.docs.length === p) {
                  //console.log(devices);
                  this.setState({ devices });
                }
              }, standardCatch)
        );
    });
  };
  componentDidUpdate = (prevProps) => {
    const { vintageOfKeys, user } = this.props;
    if (user !== prevProps.user) {
      this.queryKeys();
    }
    if (vintageOfKeys !== this.props.lastVintageName) {
      this.findKeys(vintageOfKeys);
    }
  };
  queryKeys = () => {
    const { vintageOfKeys, user } = this.props;
    if (!vintageOfKeys) {
      if (user.defaultVintage) {
        this.props.setParentState({
          //setParentState={x=>this.setState(x)}
          vintageOfKeys: user.defaultVintage
        });
      } else
        user.vintages &&
          this.props.setParentState({
            vintageOfKeys: user.vintages[0]
          });
    }
  };
  allowDeviceToRead = async () => {
    const {
      auth,
      vintageOfKeys,
      user,
      deviceCollection,
      userUpdatable,
      userDatas
    } = this.props;
    if (auth !== undefined) {
      console.log("FUMBLER");

      if (!this.state.deviceName)
        return window.alert(`please choose a device name`);
      if (!vintageOfKeys) return window.alert(`please choose a vintage name`);
      const authorId = auth.uid;
      await this.fumbler(
        userUpdatable(),
        userDatas(),
        deviceCollection(),
        this.state.deviceName,
        authorId,
        vintageOfKeys,
        this.props.rsaPrivateKeys
      )
        .then((o) => {
          this.findKeys(vintageOfKeys);
          const obj = o && JSON.parse(o);
          if (obj) {
            if (obj.fumblingComplete) {
              this.props.setKey({
                key: obj.accountBox.key,
                box: obj.accountBox.box,
                devices: obj.devices
              });
            }
          } else if (obj === "awaitingAuthMode")
            this.setState(
              {
                standbyMode: true
              },
              () =>
                window.alert(
                  "STANDBY: Please login to " +
                    (user.authorizedDevices.length > 1
                      ? "another one of "
                      : "") +
                    `your previous (${user.authorizedDevices.length}) device${
                      user.authorizedDevices.length > 1 ? "s" : ""
                    }, then come back.`
                )
            );
        })
        .catch(standardCatch);
    } else window.alert("login you must");
  };
  manuallyDeleteKeyBox = async (keybox) =>
    this.deleteFumbledKeys(keybox, this.props.deviceCollection());

  render() {
    const { vintageOfKeys, user } = this.props;
    const { keyBoxes, devices } = this.state;
    const keyboxContStyle = {
      borderBottom: "2px solid grey",
      backgroundColor: "rgb(40,40,90)",
      width: "calc(100% - 30px)",
      color: "red",
      padding: "10px",
      paddingTop: "6px",
      display: "flex",
      alignItems: "center"
    };
    return (
      <div
        ref={this.props.Vintages}
        style={{
          display: this.props.show ? "block" : "none",
          color: "white",
          boxShadow: "0px 0px 10px 2px blue",
          borderRadius: "2px",
          border: "2px rgb(200,200,200) solid",
          backgroundColor: "rgb(100,170,210)",
          margin: "6px",
          padding: "4px"
        }}
      >
        <div
          style={{
            backgroundColor: "rgb(10,17,100)",
            fontSize: "10px",
            display: "inline-block",
            lineHeight: "11px",
            padding: "2px"
          }}
        >
          On-device keybox
          <br />
          nationalsecuritycasino.com
          <br />
          login.gov convict-intranet
        </div>
        <br />
        current: {"{"}
        {this.state.deviceName ? (
          <div
            onClick={() => {
              const answer = window.confirm("edit name?");
              if (answer) this.setState({ deviceName: null });
            }}
          >
            device: {this.state.deviceName}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              this.props.ddb.storeDeviceName({
                _id: this.state.deviceNameSetter
              });

              !user.key && this.allowDeviceToRead();
            }}
          >
            <input
              className="input"
              placeholder="device name"
              onChange={(e) =>
                this.setState({ deviceNameSetter: e.target.value })
              }
            />
          </form>
        )}
        {
          //vintage name year for content encrypted
          !vintageOfKeys ? (
            <form
              style={{ display: "flex" }}
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !user.vintages ||
                  !user.vintages.includes(this.state.vintageYearSetter)
                ) {
                  this.props.setParentState({
                    vintageOfKeys: this.state.vintageYearSetter
                  });
                } else this.setState({ errVintage: "already" });
              }}
            >
              <input
                className="input"
                placeholder="vintage name"
                onChange={(e) =>
                  this.setState({
                    vintageYearSetter: e.target.value.toLowerCase()
                  })
                }
              />
              {this.state.errVintage}
              {user !== undefined && user.vintages && user.vintages.length > 0 && (
                <button
                  onClick={() =>
                    this.props.setParentState({
                      vintageOfKeys: user.vintages[0]
                    })
                  }
                >
                  &times;
                </button>
              )}
            </form>
          ) : (
            <div>
              <div
                onClick={() => {
                  const answer = window.confirm("add vintage?");
                  if (answer)
                    this.props.setParentState({ vintageOfKeys: null });
                }}
              >
                vintage: {vintageOfKeys}
              </div>
              {user.vintages && (
                <select
                  onChange={(e) =>
                    this.props.setParentState({ vintageOfKeys: e.target.value })
                  }
                >
                  {user.vintages.map((x) => {
                    return <option key={x}>{x}</option>;
                  })}
                </select>
              )}
            </div>
          )
        }
        {"}"}
        <br />
        {
          //load
          !this.state.deviceName && vintageOfKeys ? (
            "loading"
          ) : !this.state.deviceName ? (
            "name your first device"
          ) : user === undefined || !vintageOfKeys ? (
            ""
          ) : user.key ? (
            this.state.showKey ? (
              <span onClick={() => this.setState({ showKey: false })}>
                {user.key}
              </span>
            ) : (
              <button onClick={() => this.setState({ showKey: true })}>
                Show Key
              </button>
            )
          ) : (
            <button onClick={this.allowDeviceToRead}>
              {user.box ? "load key" : "modulo keybox"}
            </button>
          )
        }
        {keyBoxes.length > 0 && (
          <div style={keyboxContStyle}>
            <div>{keyBoxes.length} keyboxes</div>
            {user === undefined
              ? "your list of keyboxes once you login goes here."
              : keyBoxes.map((x) => {
                  const thisdevice = devices.find((p) => p.id === x.id);
                  //if (!thisdevice) {
                  return (
                    <div
                      key={x._id}
                      style={{
                        alignItems: "center",
                        padding: "4px 10px",
                        display: "flex",
                        borderRadius: "12px",
                        width: "max-content",
                        backgroundColor: !thisdevice
                          ? ""
                          : thisdevice.authorized
                          ? "white"
                          : thisdevice.decommissioned
                          ? "red"
                          : "yellow"
                      }}
                    >
                      {thisdevice && thisdevice.name}
                      {thisdevice && thisdevice.thisdevice && " (this)"}
                      &nbsp;/&nbsp;
                      {x._id}({x.vintage})
                    </div>
                  );
                  //}
                })}
          </div>
        )}
        {keyBoxes.length > 0 && (
          <div style={keyboxContStyle}>
            <div>{devices.length} devices</div>
            {user === undefined
              ? "your list of active devices once you login goes here."
              : devices.map((x, i) => {
                  const thisdevice = keyBoxes.find((p) => p.id === x.id);
                  if (!thisdevice) {
                    return (
                      <div
                        key={"device" + i}
                        style={{
                          alignItems: "center",
                          padding: "4px 10px",
                          display: "flex",
                          borderRadius: "12px",
                          width: "max-content",
                          backgroundColor: x.authorized
                            ? "white"
                            : x.decommissioned
                            ? "red"
                            : "yellow"
                        }}
                      >
                        {x.name}
                        {x.thisdevice && " (this)"}
                        &nbsp;/&nbsp;
                        {x._id}({x.vintage})
                      </div>
                    );
                  } else {
                    const thispendbox = user.pendingDeviceBoxes.find(
                      (p) => p.n === x.box.n
                    );
                    return (
                      <div
                        key={"device" + i}
                        style={{
                          alignItems: "center",
                          padding: "4px 10px",
                          display: "flex",
                          borderRadius: "12px",
                          width: "max-content",
                          backgroundColor: thisdevice.authorized
                            ? "white"
                            : thisdevice.decommissioned
                            ? "red"
                            : "yellow"
                        }}
                      >
                        {thisdevice.name}
                        {thisdevice.thisdevice && " (this)"}
                        {thisdevice.authorized ? (
                          <div
                            style={{
                              fontSize: "10px",
                              margin: "0px 3px",
                              border: "1px solid black",
                              padding: "4px 10px",
                              display: "flex",
                              borderRadius: "12px",
                              width: "max-content",
                              backgroundColor: "white"
                            }}
                            onClick={() => {
                              var answer = null;
                              if (!thisdevice.thisdevice) {
                                answer = window.confirm(
                                  `Are you sure you want to recind access to e2e-encrypted ` +
                                    `messages and files-shared? The next time this device signs in, ` +
                                    `they will have to request the account key again.`
                                );
                                if (answer) {
                                  this.props
                                    .deviceCollection()
                                    .doc(thisdevice.id)
                                    .update({ decommissioned: true })
                                    .then(() => {})
                                    .catch(standardCatch);
                                }
                              } else {
                                var devicesInCommission = user.devices.filter(
                                  (x) => !x.decommissioned
                                );
                                if (devicesInCommission.length === 1) {
                                  answer = window.confirm(
                                    `this is your last device, if you do not copy your key ` +
                                      `no one will be able to practically uncover your boxes`
                                  );
                                } else {
                                  answer = window.confirm(
                                    `Are you sure you want to relinquish this device's access to e2e-encrypted ` +
                                      `messages and files-shared? You will have to request the account key again.`
                                  );
                                }
                                if (answer) {
                                  this.props.manualDeleteKeyBox(x);
                                }
                              }
                            }}
                          >
                            remove
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: "10px",
                              margin: "0px 3px",
                              border: "1px solid black",
                              padding: "4px 10px",
                              display: "flex",
                              borderRadius: "12px",
                              width: "max-content",
                              backgroundColor: "white"
                            }}
                            onClick={() => {
                              var answer = window.confirm(
                                `Are you sure you want to ${
                                  thisdevice.decommissioned ? "re" : ""
                                }authorize device: ` + thisdevice.name
                              );
                              if (answer) {
                                this.props
                                  .deviceCollection()
                                  .doc(thisdevice.id)
                                  .update({
                                    decommissioned: false,
                                    authorized: true
                                  })
                                  .then(() => {})
                                  .catch(standardCatch);
                              }
                            }}
                          >
                            {thisdevice.decommissioned
                              ? "recover"
                              : "authorize"}
                            {/*x.decommissioned && (
                          <img
                            onClick={() => {
                              var answer = window.confirm(
                                "hide outstanding key"
                              );
                            }}
                            src={settings33}
                            style={{ width: "20px", height: "20px" }}
                            alt="error"
                          />
                          )*/}
                          </div>
                        )}
                        {thispendbox && <div className="loader" />}({x.vintage})
                      </div>
                    );
                  }
                })}
          </div>
        )}
      </div>
    );
  }
}

export default React.forwardRef((props, ref) => (
  <Vintages Vintages={ref} {...props} />
));
