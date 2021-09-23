import React from "react";
import PouchDB from "pouchdb";
import upsert from "pouchdb-upsert";
import firebase from "firebase/app";
import "firebase/firestore";

const parseAuthObj = (meAuth) => {
  var {
    uid,
    displayName,
    photoURL,
    email,
    emailVerified,
    phoneNumber,
    isAnonymous,
    tenantId,
    providerData,
    apiKey,
    appName,
    authDomain,
    stsTokenManager,
    refreshToken,
    accessToken,
    expirationTime,
    redirectEventId,
    lastLoginAt,
    createdAt,
    multiFactor
  } = meAuth;
  return {
    _id: uid,
    uid,
    displayName,
    photoURL,
    email,
    emailVerified,
    phoneNumber,
    isAnonymous,
    tenantId,
    providerData,
    apiKey,
    appName,
    authDomain,
    stsTokenManager,
    refreshToken,
    accessToken,
    expirationTime,
    redirectEventId,
    lastLoginAt,
    createdAt,
    multiFactor: JSON.stringify(multiFactor)
  };
};

const standardCatch = (err) => console.log("react-fuffer: " + err.message);

const optsForPouchDB = {
  revs_limit: 1, //revision-history
  auto_compaction: true //zipped...
};
//const deletion = (d, db) => db.remove(d).catch(standardCatch);
const destroy = (db) => db.destroy();
const set = (db, c) =>
  !c._id
    ? window.alert(
        "pouchdb needs ._id key:value: JSON.parse= " + JSON.parse(c)
      ) &&
      db
        .destroy()
        .then(() => null)
        .catch(standardCatch)
    : db //has upsert plugin from class constructor
        .upsert(c._id, (copy) => {
          copy = { ...c }; //pouch-db \(construct, protocol)\
          return copy; //return a copy, don't displace immutable object fields
        })
        .then(
          () => null /*"success"*/
          /** or
          notes.find((x) => x._id === c._id)
            ? this.db
              .post(c)
              .then(() => null)
              .catch(standardCatch)
          : deletion(c) && set(db, c);  
          */
        )
        .catch(standardCatch);
const read = async (db, notes /*={}*/) =>
  //let notes = {};
  await db
    .allDocs({ include_docs: true })
    .then(
      (
        allNotes //new Promise cannot handle JSON objects, Promise.all() doesn't
      ) =>
        Promise.all(
          allNotes.rows.map(async (n) => await (notes[n.doc.key] = n.doc))
        )
      // && and .then() are functionally the same;
    )
    .catch(standardCatch);
class ADB {
  constructor(name) {
    PouchDB.plugin(upsert);
    const title = "meAuth";
    this.db = new PouchDB(title, optsForPouchDB);
  }
  deleteKeys = () => destroy(this.db);
  store = (key) => set(this.db, key);
  readAuth = async (notes = {}) =>
    //let notes = {};
    await read(this.db, notes);
}

class PromptAuth extends React.Component {
  constructor(props) {
    super(props);
    var storedAuth = undefined;
    let adb = new ADB();
    this.state = {
      adb,
      storedAuth,
      tickets: [],
      myCommunities: [],
      folders: []
    };
  }
  promptAuth = () =>
    this.state.adb
      .readAuth()
      .then((result) => {
        const { verbose } = this.props;
        if (result.length === 0) {
          verbose && console.log("REACT-LOCAL-FIREBASE: no user stored...");
        } else {
          var msg = null;
          var storedAuth = result[0];
          if (!storedAuth) return (msg = "new authdb");
          var meAuth = { ...storedAuth };

          if (storedAuth.isAnonymous) {
            msg = "REACT-LOCAL-FIREBASE: authdb is anonymous";
            meAuth.multiFactor = JSON.parse(meAuth.multiFactor);
          } else if (storedAuth._id !== "none")
            msg = "REACT-LOCAL-FIREBASE: authdb is identifiable";

          verbose && console.log(msg);
          this.setState(
            {
              storedAuth
            },
            () =>
              this.props.setFireAuth({
                meAuth
              })
            //reused
          );
        }
      })
      .catch((err) => console.log(err));
  componentDidMount = () => {
    this.promptAuth();
  };
  storeAuth = (meAuth, logout, hasPermission) => {
    const { verbose } = this.props;
    const store = (storedAuth, method, logout) =>
      this.state.adb[method](storedAuth)
        .then((res) =>
          this.setState(
            {
              storedAuth
            },
            () => this.props.setFireAuth({ isStored: res, logout })
          )
        )
        .catch(standardCatch);
    if (Object.keys(meAuth).length === 0)
      return this.props.setFireAuth({ meAuth: {} }, () =>
        store({ _id: "none" }, "store", logout)
      );
    verbose && console.log("REACT-LOCAL-FIREBASE: " + meAuth.uid + " found");
    var stripped = parseAuthObj(meAuth);

    if (this.state.storedAuth !== stripped) {
      //getUserData from update
      //new meAuth object
      this.props.setFireAuth({ meAuth });
      verbose &&
        console.log(
          "REACT-LOCAL-FIREBASE: " + meAuth.uid + " being stored grant" //+ stripped.isAnonymous ? "" : "?"
        );
      if (stripped.isAnonymous) return store(stripped, "store");

      var stor = true;
      if (!hasPermission) {
        stor = window.confirm(
          "is this a private device? if so, can we store your auth data?" +
            `(${stripped.displayName},${stripped.phoneNumber},${stripped.email})`
        );
      }

      if (stor) {
        store(stripped, "store");
      }
    }
  };

  getUserInfo = async (verbose, auth, storedAuth) => {
    if (this.props.meAuth && this.props.meAuth.isAnonymous)
      return await new Promise((resolve) => resolve("login?"));
    var msg = null;
    if (storedAuth !== undefined) {
      msg =
        "REACT-LOCAL-FIREBASE: " +
        storedAuth.uid +
        " is stored, saving on costs here";

      if (!storedAuth.multiFactor) {
        msg =
          "REACT-LOCAL-FIREBASE: " +
          storedAuth.uid +
          " is substandard; !meAuth1.multiFactor, deleting these from pouchdb..";

        this.state.adb.deleteKeys();
      } else {
        msg =
          storedAuth.uid + ": JSON.parse-ing 'meAuth1.multiFactor' object..";

        var meAuth = { ...this.props.meAuth };
        meAuth.multiFactor = JSON.parse(storedAuth.multiFactor);
        this.props.setFireAuth({ meAuth });
        //anonymous
        if (meAuth.isAnonymous) {
          console.log(meAuth.uid + " is anonymous");
        } else this.storeAuth(storedAuth, false, true);
      }
      verbose && console.log(msg);
    }
    !auth &&
      firebase.auth().onAuthStateChanged((meAuth) => {
        verbose &&
          console.log("REACT-LOCAL-FIREBASE: firebase authentication called");
        if (!meAuth)
          return firebase
            .auth()
            .signInAnonymously()
            .then(() => {
              verbose &&
                console.log("REACT-LOCAL-FIREBASE: getting fake user data...");
              var answer = window.confirm("login?");
              if (answer) this.props.onPromptToLogin();
            })
            .catch(standardCatch);

        this.storeAuth(meAuth);
      }, standardCatch);
    //strict promise
    return await new Promise(
      (resolve) =>
        meAuth &&
        meAuth.constructor === Object &&
        meAuth.isAnonymous &&
        meAuth
          .delete()
          .then(() => {
            window.alert(
              "REACT-LOCAL-FIREBASE: successfully removed anonymous account"
            );
            verbose &&
              console.log(
                "REACT-LOCAL-FIREBASresolve(meAuth.isAnonymous)E: " +
                  meAuth.uid +
                  " is logged in"
              );
            resolve(meAuth.isAnonymous);
          })
          .catch(standardCatch)
    );
  };
  render() {
    const { verbose, auth } = this.props;
    const { storedAuth } = this.state;
    return (
      <div>
        <div
          ref={this.props.pa}
          style={this.props.style}
          onClick={async () => {
            this.storeAuth(...this.props.storableAuth);
            this.props.clearStore();
          }}
        />
        <div
          ref={this.props.fwd}
          style={this.props.style}
          onClick={async () => {
            this.props.onStart();
            var res;
            if (this.props.reset) {
              res = await this.storeAuth({});
              this.props.resetResetAuth();
            } else {
              res = await this.getUserInfo(verbose, auth, storedAuth);
              if (res === "login?") this.props.onPromptToLogin();
            }
            if (res) this.props.onFinish(); //res.isAnonymous
          }}
        />
      </div>
    );
  }
}
export default React.forwardRef((props, getRefs) => {
  const { pa, fwd } = props.getRefs();
  return <PromptAuth fwd={fwd} pa={pa} {...props} />;
});
/*export default React.forwardRef((props, ref) => {
  return <PromptAuth fwd={ref.fwd} pa={ref.pa} {...props} />;
});*/

/**
 * 
        {React.forwardRef((props, ref) =>
          React.createElement(
            <div
              ref={ref}
              style={this.props.style}
              onClick={async () => {
                this.props.onStart();
                const res = await this.getUserInfo(verbose, auth, storedAuth);
                if (res === "login?") this.props.onPromptToLogin();
                if (res) this.props.onFinish(); //res.isAnonymous
              }}
            />,
            props
          )
        )}
 */
