import React, { useEffect, useRef, useState, useCallback } from "react";
import firebase from "firebase/app";
import "firebase/firestore";

const refresh = "";

const postIdToSubdocument = (dropId, keepalive) => {
  //hydratePost (banned on Medium.com vianickcarducci.medium.com, 5/2021)
  if (!dropId.startsWith("")) return null;
  const id = dropId.replace(/^[a-zA-Z]/g, "");
  const collection = dropId.substring(0, dropId.indexOf(id));
  //return { id, collection };
  const free = Jail(
    //for each: foo = {...doc.data(),doc.id}
    firebase.firestore().collection(collection).doc(id),
    keepalive,
    null, //sort for firestore orderBy { order: "time", by: "desc" }
    null, //near for geofirestore { center: near.center, radius: near.distance }
    //sort && near => cannot be true (coexist, orderBy used by geohashing)
    14, //limit
    null, //startAfter
    null //endBefore
  );
  //Jail always returns an array, handle as such (here, single ".doc(")
  const doc = free.docs[0]; //product
  if (doc.exists) {
    var foo = doc.data();
    foo.collection = collection;
    foo.id = id;
    foo.messageAsArray = foo.message ? arrayMessage(foo.message) : [];
    return foo;
  }
};
const Jail = (
  snapshotQuery,
  keepalive,
  sort,
  near, //sort && near cannot be true (coexist, orderBy used by geohashing)
  limit,
  startAfter,
  endBefore,
  verbose //REFER TO Readme.md
) => {
  keepalive = keepalive ? keepalive : 3600000;
  //no need for async await here in database-jail. React.funcs seem to abstract
  //___(not-Promises) for that async await is unneccesary functions run once,
  //insofarthatso [async/await, Promises] aren't handled
  var jail = useRef(false); //Object.values(functionRefs).length > 0
  //references "this." function
  const dele = snapshotQuery._delegate ? snapshotQuery : snapshotQuery._query;
  const match =
    dele._delegate._query.path.segments.join(",") +
    "/" +
    dele._delegate._query.filters
      .map((x) => x.field.segments.join(""))
      .join(","); //String(snapshotQuery);

  //const thisFunc = functionRefs.find(x=>x.id===String(snapshotQuery))
  // is exported from outside this()/jail/"JailFunction"
  //The purpose of this func is [non-scalar, linear], idle longpolling, or to
  //restart keepalive/buffer-if-time-is-more-than-exponentially-related
  //How to use firebase-firestore's official experiment for this:
  /*firebase.initializeApp(firebaseConfig);
    firebase.firestore().settings({ experimentalForceLongPolling: true });*/
  //const close = onSnapshot() will not depreciate, as an experiment might
  //Description by me is: long-polling for react, [as abstracted] as "keepalive" is in python,
  //+/which is(?) how firestore.settings({longPolling}))'s for firebase firestore "onSnapshot"
  //also & primarily to lessen concurrent snapshot listeners whilst maintaining live data
  const [close, joist] = useState(null); //closeSnapshot, function-in-state
  //to close:()=>{}; in "useState"/updateState, update-state
  //close /*ready*/ &&
  //variables must be defined inside useEffect, if used in it...
  const [docs, updateSet] = useState(null);
  const query = near
    ? snapshotQuery.near(near)
    : sort && sort.order
    ? snapshotQuery.orderBy(sort.order, sort.by ? sort.by : "desc")
    : snapshotQuery;
  const queryWithFixins = startAfter
    ? query.startAfter(startAfter).limit(limit)
    : endBefore
    ? query.endBefore(endBefore).limitToLast(limit)
    : query.limit(limit);
  const save =
    //hoist in-hoist (here, state)// this isn't tested, I would think this would be automated
    //is saved as function-in-state, runs once
    //easterEgg: classless-functions aren't running Promises (returns or breaks) like classes; so,
    //no need to use Promises, & thense: resolve without waiting. ever.
    //randomEasterEgg: data hydrateUser shows how to snapshot by running twice
    //to notify && get() for subcollectioning/nesting-an-object on the ui/device
    queryWithFixins.onSnapshot((qs /*querySnapshot*/) => {
      //mean: no waiting for update responses to get from,
      //like it as for subobjects/"subdocuments"/subdocument
      let p = 0;
      let dol = [];
      (!match.includes(".doc(") ? qs.docs : [qs]).forEach(async (doc) => {
        p++;
        if (doc.exists) {
          var foo = fooize(doc, match, keepalive);
          //subdocuments work as snapshot without promises here! forget data.js hydrateUser
          foo.drop = await postIdToSubdocument(foo.dropId, keepalive);
          foo.drops = foo.dropIds.map(
            async (f) => await postIdToSubdocument(f, keepalive)
          );
          foo.messageAsArray = foo.message ? arrayMessage(foo.message) : [];
          dol.push(foo);
        }
      });
      if (qs.docs.length === p) {
        startAfter = qs.docs[qs.docs.length - 1];
        endBefore = qs.docs[0];
        updateSet(dol);
      }
    }, standardCatch);
  joist(save);

  //timeoutRemountFirebaseSnapshot/"keepalive"
  const [reset, resetCancel] = useState(false);
  const Counting = () => {
    const [result, update] = useState(false);
    useEffect(() => {
      jail.seconds && clearInterval(jail.seconds);
      jail.seconds = setInterval(() => update(keepalive - 1000), 1000);
      return () => clearInterval(jail.seconds);
    }, []);
    return result;
  };
  let aliveFor = Counting();
  if (reset) {
    //aliveFor = Counting();
    this(
      snapshotQuery, //1
      keepalive, //2
      sort, //3
      near, //sort && near => cannot be true (coexist, orderBy used by geohashing)
      limit, //5
      startAfter, //6
      endBefore, //7
      verbose //8
    ); //resetCancel(false)
  } //reset onSnapshot if reset/"reset", with same ref (same String(snapshotQuery)/"match"/JailFunction.id)

  //React: "If your effect returns a function, React will run it
  //[as it would to] clean up" 86*'when it is time to'
  useEffect(() => {
    /**Assignments to the ___ variable from inside React Hook
     * useEffect will be lost after each render. */
    //clearInterval(this.ref) runs when called,
    //restarts keep-alive for "are you still there?" response
    verbose && console.log(docs.length + " results");
    //long-polling for react, [as abstracted] as "keepalive" is in python,
    jail.murder && clearTimeout(jail.murder);
    jail.murder = setTimeout((e) => close(), keepalive); //1hr
    return () => clearTimeout(jail.murder);
  }, [close, docs, keepalive, verbose]); //when call this(), reset/resets count until close()

  //useEffect([foo,bar],effect) should be the firstly-inputted "props" for
  //useEffect(()=>effect(),[foo,bar])
  //effect(() => {return () => {/*componentWillUnmount*/;};});
  //runs when [mounting func-component ["this." or useRef()], [foo,bar]]
  //"[one interpolation begets all of 'props' object anyway]"

  return {
    docs,
    refresh: useCallback(() => resetCancel(true), []),
    id: match,
    aliveFor,
    startAfter,
    endBefore,
    verbose
  };
};

const arrayMessage = (message) =>
  message
    .toLowerCase()
    //capture or, excluding set, match 2 or more of the preceding token
    .replace(/((\r\n|\r|\n)+[^a-zA-Z]+_+[ ]{2,})+/g, " ")
    .split(" ");
const standardCatch = (err) => console.log("react-fuffer: " + err.message);
const fooize = (doc, match, keepalive) => {
  var foo = doc.data();
  foo.id = doc.id;
  //const inx = match.indexOf("collection(");
  //foo.collection = match.substring(inx, inx + "collection(".length);
  //foo.collection.substring(0, foo.collection.indexOf(")"));
  foo.collection = match.split("/")[0];
  foo.messageAsArray = foo.message ? arrayMessage(foo.message) : [];
  return foo;
};

class WakeSnapshot extends React.Component {
  unmount = (func) =>
    this.props.setJail({
      jailclasses: this.props.jailclasses.filter((y) => func.id !== y.id),
      closes: this.props.closes.filter((y) => !y[func.id]),
      alivefors: this.props.alivefors.filter((y) => !y[func.id]),
      //deletedclasses is just for remounting without ...traveling
      deletedclasses: [
        ...this.props.deletedclasses,
        { ...func.resnap, id: func.id }
      ],
      updatedclasses: this.props.updatedclasses.filter((u) => u.id !== func.id),
      freedocs: this.props.freedocs.filter((u) => u.id !== func.id)
    });
  remount = (animal) =>
    this.props.remount(
      {
        jailclasses: this.props.jailclasses.filter((y) => animal.id !== y.id),
        closes: this.props.closes.filter((y) => !y[animal.id]),
        alivefors: this.props.alivefors.filter((y) => !y[animal.id]),
        //not deleted...remounted
        //deletedclasses is just for remounting without ...traveling, await for send
        updatedclasses: this.props.updatedclasses.filter(
          (u) => u.id !== animal.id
        ),
        freedocs: this.props.freedocs.filter((u) => u.id !== animal.id),
        resnaps: this.props.resnaps.filter((u) => u.id !== animal.id)
      },
      animal
    );
  flush = () =>
    this.props.freedocs.forEach((animal) => {
      this.remount(animal);
    });

  render() {
    const { isProfile, openAnyway, freedocs } = this.props;
    const goingSnapshots = freedocs && freedocs.constructor === Array;
    const atLeastOne =
      goingSnapshots &&
      freedocs.find((x) => x.aliveFor > 0 && x.aliveFor < 1200000);
    const open = atLeastOne || openAnyway;
    const stylequick = {
      margin: open ? "0px 20px" : "0px 0px",
      borderRadius: "22px",
      boxShadow: "0px 0px 7px 2px black",
      border: "4px solid rgb(160,200,255)",
      borderBottom: "7px solid rgb(160,200,255)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "30px",
      backgroundColor: "rgb(20,60,120)",
      color: "rgb(220,220,240)"
    };
    return (
      <div
        style={{
          overflow: !open ? "hidden" : "",
          fontSize: open ? "" : "0px",
          height: open ? "min-content" : "0px",
          width: "100%",
          textAlign: "center",
          alignItems: "center",
          flexDirection: "column",
          overflowWrap: "break-word",
          zIndex: "10",
          display: "flex",
          position: isProfile ? "fixed" : "relative",
          transition: ".3s ease-in"
        }}
      >
        are you still there?
        <div
          onClick={this.flush}
          style={{
            fontSize: open ? "" : "0px",
            border: `${open ? 3 : 0}px green solid`,
            borderRadius: open ? "9px" : "0px",
            padding: open ? "4px 10px" : "0px 0px",
            marginTop: open ? "3px" : "0px",
            transition: ".3s ease-in"
          }}
        >
          YES
        </div>
        <br />
        Ongoing Processes
        <br />
        <div
          style={{
            margin: open ? "10px 0px" : "0px 0px",
            width: "calc(100% - 10px)",
            border: "2px solid",
            borderRadius: "10px"
          }}
        >
          {open &&
            freedocs &&
            freedocs.map((func, i) => {
              const thisalivefor = this.props.alivefors.find((y) => y[func.id]);
              const thisclose = this.props.closes.find((y) => y[func.id]);
              return (
                <div
                  key={func.id + i}
                  style={{
                    margin: "10px 0px",
                    alignItems: "center",
                    display: open ? "flex" : "none",
                    opacity:
                      func.aliveFor > 0 && func.aliveFor < 1200000
                        ? func.aliveFor / 2400000
                        : 1
                  }}
                >
                  <span style={{ ...stylequick, padding: "0px 5px" }}>
                    {func.id}&nbsp;-&nbsp;
                    {thisalivefor && Object.values(thisalivefor)}
                  </span>
                  <div
                    style={{ ...stylequick, width: "30px" }}
                    onClick={() => this.remount(func)}
                  >
                    ↻
                  </div>
                  <div
                    style={{ ...stylequick, width: "30px" }}
                    onClick={() => {
                      thisclose && thisclose[func.id]();
                      this.unmount(func);
                    }}
                  >
                    &times;
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }
}

/*const myFunc = forwardRef((props,ref)=>{
  //only takes (props,ref), like:
  useEffect(() => {//not really optional
    clearInterval(ref.current);
    ref.current = setInterval(props.close, keepalive);
    return () => clearInterval(ref.current);//unmount cleanup
  }, [foo,bar]);//when [these change] update, other than onmount mount
})*/

//snapshotQuery._delegate._query.path.segments

export class PostIdToSubdocumentClass extends React.Component {
  componentDidUpdate = async (prevProps) => {
    //if (this.state.drops !== this.state.lastDrops)
    //this.setState({ lastDrops: this.state.drops }, () => {});
    if (this.props.droppable !== prevProps.droppable)
      this.props.droppable.forEach((obj) => {
        //hydratePost (banned on Medium.com vianickcarducci.medium.com, 5/2021)
        if (!obj.dropId.startsWith("")) return null;
        const id = obj.dropId.replace(/^[a-zA-Z]/g, "");
        const collection = obj.dropId.substring(0, obj.dropId.indexOf(id));
        //return { id, collection };
        firebase
          .firestore()
          .collection(collection)
          .doc(id)
          .onSnapshot((doc) => {
            if (doc.exists) {
              var foo = doc.data();
              foo.collection = collection;
              foo.id = id;
              foo.messageAsArray = foo.message ? arrayMessage(foo.message) : [];
              let rest = [];
              let newFreedoc = null;
              this.props.freedocs.forEach((y) => {
                const thisone = y.docs.find((x) => x.dropId === obj.dropId);
                if (thisone) {
                  thisone.drop = foo;
                  return (newFreedoc = {
                    ...y,
                    docs: [
                      ...y.docs.filter((x) => x.dropId !== thisone.dropId),
                      thisone
                    ]
                  });
                }
                rest.push(y);
              });
              this.props.setJail({ freedocs: [...rest, newFreedoc] });
            }
          }, standardCatch);
      });
    if (this.props.droppables !== prevProps.droppables)
      this.props.droppables.forEach((drops) => {
        drops.forEach((obj) => {
          //hydratePost (banned on Medium.com vianickcarducci.medium.com, 5/2021)
          if (!obj.dropId.startsWith("")) return null;
          const id = obj.dropId.replace(/^[a-zA-Z]/g, "");
          const collection = obj.dropId.substring(0, obj.dropId.indexOf(id));
          //return { id, collection };
          firebase
            .firestore()
            .collection(collection)
            .doc(id)
            .onSnapshot((doc) => {
              if (doc.exists) {
                var foo = doc.data();
                foo.collection = collection;
                foo.id = id;
                foo.messageAsArray = foo.message
                  ? arrayMessage(foo.message)
                  : [];
                let rest = [];
                let newFreedoc = null;
                this.props.freedocs.forEach((y) => {
                  const thisone = y.docs.find((x) => x.dropIds === obj.dropIds);
                  if (thisone) {
                    thisone.drops = [
                      ...thisone.drops.filter(
                        (x) => x.collection + x.id !== foo.collection + x.id
                      ),
                      foo
                    ];
                    return (newFreedoc = {
                      ...y,
                      docs: [
                        ...y.docs.filter((x) => x.dropId !== thisone.dropId),
                        thisone
                      ]
                    });
                  }
                  rest.push(y);
                });
                this.props.setJail({ freedocs: [...rest, newFreedoc] });
              }
            }, standardCatch);
        });
      });
  };
  render() {
    return <div />;
  }
}

class JailClass extends React.Component {
  constructor(props) {
    super(props);

    this.state = { updateables: [] };
    this.closeTimeouts = {};
    this.closeTimer = {};
    this.aliveTimer = {};
  }
  matchy = (snapshotQuery) => {
    const dele = snapshotQuery._delegate ? snapshotQuery : snapshotQuery._query;

    return (
      dele._delegate._query.path.segments.join(",") +
      "/" +
      dele._delegate._query.filters
        .map((x) => x.field.segments.join(""))
        .join(",")
    );
  };
  componentWillUnmount = () => {
    this.props.updatedclasses.forEach((x) => {
      this.closeTimer[this.matchy(x.snapshotQuery)] &&
        clearTimeout(this.closeTimer[this.matchy(x.snapshotQuery)]);
      this.aliveTimer[this.matchy(x.snapshotQuery)] &&
        clearInterval(this.aliveTimer[this.matchy(x.snapshotQuery)]);
    });
  };
  componentDidUpdate = (prevProps) => {
    if (this.props.jailclasses !== prevProps.jailclasses) {
      //Make sure query object for class injection is ONLY new ones.
      //Though the rest of react-fuffer ops like unmount & remount
      //strictly doesn't run a jailclasses[n] without intent, the
      //component updates when any part of the whole array changes

      this.updateUpdateables(
        this.props.jailclasses.filter(
          (x) => !this.state.updateables.find((u) => u.uuid === x.uuid)
        )
      );
    }
  };
  updateUpdateables = (updateables) =>
    this.setState(
      {
        updateables: [...this.state.updateables, ...updateables]
      },
      () =>
        this.state.updateables.forEach((x) => {
          const {
            uuid,
            snapshotQuery,
            keepalive,
            sort,
            near, //sort && near cannot be true (coexist, orderBy used by geohashing)
            limit,
            startAfter,
            endBefore,
            verbose, //REFER TO Readme.md
            whenOn
          } = x;
          this.setState({
            updateables: this.state.updateables.filter((x) => x.uuid !== uuid)
          });
          verbose && console.log(x.uuid);

          const match = this.matchy(snapshotQuery);
          var alivefor = keepalive ? keepalive : 3600000;
          const close = () => {
            if (this.aliveTimer[match]) {
              verbose &&
                console.log(
                  "dev: this.aliveTimer[match] found in class component"
                );
              clearInterval(this.aliveTimer[match]);
            } /*else
        console.log(
          "dev: this.aliveTimer[match] not found in class component"
        );*/
            this.props.setJail({
              updatedclasses: this.props.updatedclasses.filter(
                (u) => u.uuid !== uuid
              ),
              alivefors: this.props.alivefors.filter((x) => !x[match])
            });
            if (this.closeTimeouts[match]) {
              this.closeTimeouts[match]();
              verbose &&
                console.log(
                  `REACT-FUFFER: CLOSED @firebase/firestore, Firestore Connection WebChannel transport: ` +
                    match
                );
            }
          };
          let pause = 0;
          if (this.props.updatedclasses.find((u) => u === x)) {
            close();
            pause = 3400;
          }

          const run = () => {
            this.closeTimer[match] && clearTimeout(this.closeTimer[match]);
            this.closeTimer[match] = setTimeout(() => close(), alivefor);
            this.aliveTimer[match] && clearInterval(this.aliveTimer[match]);
            this.aliveTimer[match] = setInterval(() => {
              const thisAFor = this.props.alivefors.find((x) => x[match]);
              this.props.setJail({
                alivefors: [
                  {
                    [match]: !thisAFor
                      ? alivefor - 1000
                      : thisAFor[match] - 1000
                  },
                  ...this.props.alivefors.filter((x) => !x[match])
                ]
              });
            }, 1000);

            const firebase = near
              ? snapshotQuery.near(near)
              : sort && sort.order
              ? snapshotQuery.orderBy(sort.order, sort.by ? sort.by : "desc")
              : snapshotQuery;
            const firestore = startAfter
              ? firebase.startAfter(startAfter).limit(limit)
              : endBefore
              ? firebase.endBefore(endBefore).limitToLast(limit)
              : firebase.limit(limit);

            //firebase.firestore().onSnapshot(...)
            this.closeTimeouts[match] = firestore.onSnapshot((qs) => {
              let p = 0;
              let docs = [];
              var qsdocs = !match.includes(".doc(") ? qs.docs : [qs];
              qsdocs.forEach((doc) => {
                p++;
                if (doc.exists) {
                  var foo = fooize(doc, match, keepalive);
                  if (foo.dropId)
                    this.setState({
                      droppable: [
                        ...this.state.droppable.filter(
                          (x) => x.collection + x.id !== foo.collection + x.id
                        ),
                        foo
                      ]
                    });
                  if (foo.dropIds)
                    this.setState({
                      droppables: [
                        ...this.state.droppables.filter(
                          (x) => x.collection + x.id !== foo.collection + x.id
                        ),
                        foo
                      ]
                    });
                  //foo.dropIds.map((f) => postIdToSubdocumentClass(f))
                  //: [];
                  docs.push(foo);
                }
              });
              //this.closeTimeouts[match].bind(this);
              if (qsdocs.length === p) {
                //functional-matching match func "fuffer"
                this.props.setJail({
                  updatedclasses: [...this.props.updatedclasses, x]
                });
                verbose && console.log("fuffer:" + uuid, x.state, docs);
                this.props.updateLiberty({
                  uuid,
                  state: x.state,
                  docsOutputLabel: x.docsOutputLabel,
                  alivefor,
                  docs,
                  startAfter: qsdocs[qsdocs.length - 1],
                  endBefore: qsdocs[0],
                  id: match,
                  verbose,
                  whenOn
                });
              }
            }, standardCatch);
            const thisClose = this.props.closes.find((x) => x[match]);
            this.props.setJail({
              closes: [
                { [match]: !thisClose ? close : thisClose[match] },
                ...this.props.closes.filter((x) => !x[match])
              ]
            });
            const thisresnap = this.props.resnaps.find((x) => x[match]);
            this.props.setJail({
              resnaps: [
                { [match]: !thisresnap ? x : thisresnap[match] },
                ...this.props.resnaps.filter((x) => !x[match])
              ]
            });
          };
          setTimeout(() => run(), pause);
          if (!x.done) {
            x.done = true;
          }
        })
    );
  render() {
    return (
      <div id="fuffer" ref={this.props.fuffer}>
        <PostIdToSubdocumentClass
          droppable={this.state.droppable}
          droppables={this.state.droppables}
          setJail={this.props.setJail}
          freedocs={this.props.freedocs}
        />
      </div>
    );
  }
}
//const fic = Object.values(functionRefs);
//const functionCount = fic.length > 0;
export {
  //functionRefs,
  //functions,
  //functionCount,
  Jail,
  firebase,
  WakeSnapshot,
  JailClass
};
//export default JailClass;
/*React.forwardRef((props, ref) => (
  <JailClass fuffer={ref} {...props} />
));*/

/*if (this.state.reset) {
  this.setState({reset:false},()=>{
  JailClass(
    snapshotQuery,
    keepalive,
    sort,
    near, //sort && near => cannot be true (coexist, orderBy used by geohashing)
    limit,
    startAfter,
    endBefore,
    verbose,
    whenOn
  ); //resetCancel(false)
  })
}*/
/*const {
  //connection,
  queryWithFixins,
  match,
  keepalive,
  verbose,
  whenOn
} = this.props;*/
//const { jailclasses } = this.props;

//  //long-polling for react, [as abstracted] as "keepalive" is in python,
//
//refresh / reset resores keepalive = 1hr with this in new Set of funcs
//still allows firestore to disconnect as it does its abstracted long polling
//verbose && console.log(fmFUFFER);

//RTCDataChannel also requires JSON objects to be strings
//return product;

/*await new Promise((resolve) => {
  clearInterval(current.poll);
  current.poll = setInterval(() => {
    product.sendableDocs &&
      resolve(
        JSON.stringify({
          startAfter: product.startAfter,
          endBefore: product.endBefore,
          docs: product.sendableDocs,
          refresh: () => (reset = true),
          id: match,
          alivefor,
          verbose,
          whenOn,
          close: product.close
        })
      );
  }, 6732);
});*/

//const snapFuncs = snapFuncs;
//let first = false;
//arrow functions are like tiny react apps!, they bind this, et. al
//var currentExists = Object.values(snapFuncs).find((f) => f.id === match);

//clearIntervall() && setInterval() would have been useful here
//to pass the object through a {dataChannel:RTCDataChannel,close:()=>close()}
//WRONG: but window => dom access is fine, or this page... var(s) at top of page outside
//default makeshitSnapshot = null
//REASON: the value is lost, must use RTCDataChannel
//var current = { id: match };
/*var current = Object.values(functionRefs).find((f) => f.id === match);
if (!current) {
//so this probably always !current
current = { id: match };
functionRefs.add(current);
}*/
//snapshotQuery._delegate._query.path.segments

/*if (first) {
        localizedDocs = docs; //renders on mount
        first = true;
      } else {
        const w2319 = docs.find((x) => {
          const newDoc = dbFUFFER[match].find((y) => y.id === x.id);
          return newDoc !== x;
        });
        if (w2319) localizedDocs.push(w2319);
      }*/

/**
       *
      clearInterval(dataParent.cancel);
      dataParent.cancel = setInterval(() => {
        var rumble;
        clearInterval(rumble);
        rumble = setInterval(() => {
          if (localizedDocs && localizedDocs.length === 0) {
            return whenOn && console.log(match + " running, nothing new..");
          } else {
            verbose &&
              console.log(
                `upFUFFER upFUFFER hold on we got something (localizedDocs ${match})`
              );
            localizedDocs.map((one) => {
              const rest = sendableDocs.filter((x) => x.id !== one.id);
              verbose && console.log([...rest, one]);
              verbose && console.log("_loading into sendableDocs (docs Array)");
              sendableDocs = [...rest, one]; //window.fuffer.dbFUFFER[match]
              verbose && console.log(sendableDocs);
              //.send thru RTCDataChannel
              return (localizedDocs = localizedDocs.filter(
                (x) => x.id !== one.id
              ));
            });
          }
        }, 3000);
      }, 10000);
       */
/*var receivers = connection.getReceivers();
      console.log(
        receivers.length + " DataChannel-receivers on this RTCPeerConnection"
      );
      const peerId = 65534 - receivers.length;
      const opts = { negotiated: true, id: peerId };
      var datachannel = connection.createDataChannel(
        `label for channel ${match}`,
        opts
      );*/

/*var pc = new RTCPeerConnection();
    const opts = { negotiated: true, id: product.peerId };
    //peer connection can have up to a theoretical maximum of 65,534 data channels
    var dc = pc.createDataChannel(
      `label for channel ${product.id} if ${product.peerId}`,
      opts
    );
    dc.onopen = () => {
      console.log("datachannel open");
    };
    product.dc.onmessage = (event) =>
      console.log("received: " + event.data);

    product.dc.onclose = () => console.log("datachannel close");
  */

//pass thru forwardRef object of onSnapshot response for Class
/*var functionRefs = new Set();
const fic = Object.values(functionRefs);
const functionCount = fic.length > 0;*/
//window.fuffer = { fmFUFFER: [] };

//snapFuncs = new Set();

/*constructor(props) {
  super(props);
  this.state = {};
  this.fuffer = this.props.fuffer;ref from parent
  fuffer.snapFuncs = new Set();
}*/
/*if (!window.fuffer.fmFUFFER.includes(match)) {
console.log(docs);
console.log(match);
window.fuffer.fmFUFFER.push(match);
}*/
/*{
  state: x.state,
  docsOutputLabel: x.docsOutputLabel,
  alivefor,
  docs,
  startAfter: qs.docs[qs.docs.length - 1],
  endBefore: qs.docs[0],
  id: match,
  verbose,
  whenOn
}*/
/**
 * product = {state:{}, ...product}
 */
//[product.docsOutputLabel]: product.docs,
