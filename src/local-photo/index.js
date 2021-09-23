import React, { lazy } from "react";
import PouchDB from "pouchdb";
import upsert from "pouchdb-upsert";

const lazyImageStyle = {
  position: "relative",
  transition: ".3s ease-in",
  width: "100%",
  height: "auto"
};

class PhotoDB {
  constructor() {
    PouchDB.plugin(upsert);
    this.db = new PouchDB("react-local-photo", {
      revs_limit: 1,
      auto_compaction: true
    });
  }
  async readPhotos() {
    let allInfo = await this.db
      .allDocs({ include_docs: true })
      .catch((err) => console.log(err.message));
    let notes = {};
    allInfo && allInfo.rows.forEach((n) => (notes[n.doc._id] = n.doc));

    return notes;
  }

  async setPhoto(c) {
    if (!c._id) {
      window.alert("REACT-LOCAL-PHOTO_dev: pouchdb needs ._id key:value");
      //this.db.destroy();
    } else {
      var copy = {};
      const prenotes = await this.readPhotos();
      if (prenotes) {
        const photos = Object.values(prenotes);
        const found = photos.find((x) => x._id === c._id);

        if (found) {
          copy = { ...found };
          if (c.fallback) copy.fallback = c.fallback;
          /*return await this.db.putAttachment(
          "doc",
          "att.txt",
          c._attachments,
          "text/plain"
        );*/
        }
        return await this.db
          .upsert(c._id, (doc) => {
            doc = { ...c };
            return doc;
          })
          .catch((err) => console.log(err.message));
      }
    }
  }

  async deletePhoto(note) {
    return await this.db.remove(note).catch((err) => console.log(err.message));
  }
  /*destroyPhotoDB() {
    this.db.destroy();
  }*/
}
class Composition extends React.Component {
  constructor(props) {
    super(props);
    //set innerHTML is dangerous for changing img.src as is when initiated by const, var or
    //this.Closed = new Image(); *DO NOT USE except in props..* constructor allowed
    //by React, but for img.src change 're-render,' after mounting an <img/>
    //DOM in the JSX itself therin style can update with this in constructor here at top
    /**
     * new Image() hard to use except as props in React. Are there performance considerations
     * for all img.props here for changes to img object? Virtual DOM mounts & does re-render
     * (or match?) img.props.style changes, but not if field is defined outside of the sync func.
     * Second option guides us to use static props like style={{width:"100%}} so I choose
     * to export class <div style={{width:maxWidth?maxWidth:"0%"}}> wrapping {React.createElement
     * for import().then(img=>img.default) & window.URL.createObjectURL(blob), src}, as only
     * change's css calc not all props, which I only assume matters
     */
    //(1){ ()(this.Photo = React.createRef() = new Image())} or (2){ just use width:"100%"
    //on the static React.createElement for one, clean mount
    /*const pr_ps = {...props, src: import() ? img.default : window.URL.createObjectURL }
      const myImage = React.createElement("img", pr_ps, null);
    //}*/
    const photoDB = new PhotoDB();
    this.state = {
      photos: [],
      photoDB
    };
    //this.Photo = React.createRef();
    //this.Closed = React.createRef();
    //this.canvasOpen = React.createRef();
    //this.canvasClosed = React.createRef();
  }
  async handleDelete(id, i) {
    let { photos } = this.state;
    var photo = photos.find((x) => x._id === id + i);
    var res = null;
    if (photo) {
      res = await this.state.photoDB
        .deletePhoto(photo)
        .then(() => {
          return photo._id; //console.log("deleted photo from local " + photo._id);
          //this.getNotes();
        })
        .catch((err) => console.log(err.message));
    } else {
      res = true;
      console.log("no photo to delete");
    }
    return res && res;
  }
  storePhoto = async (fallback, id, i, verbose) => {
    var readFile = new FileReader();
    var save = null;
    await fetch(fallback, {
      //"Access-Control-Allow-Origin": "*",
      mode: "no-cors"
    })
      .then((blob) => blob.blob())
      .then((img) => {
        if (!/image/.test(img.type)) {
          return null; //not an image
        }
        save = async (data) =>
          (await this.state.photoDB["setPhoto"]({
            _id: id + i,
            _attachments: {
              [id]: {
                content_type: img.type, // 'image/png',
                data //base64
              }
            },
            src: fallback
          })) && this.getPhotos(id, i, fallback, verbose);

        readFile.readAsDataURL(img);
        /*var reader = new FileReader();
        reader.readAsArrayBuffer(img);
        FileReader.readAsDataURL:
        "returns base64 that contains many characters, 
        and use more memory than blob url, but removes
        from memory when you don't use it (by garbage collector)"*/
      })
      .catch((err) =>
        this.setState(
          {
            Errorf: err.message,
            Photo: null
          },
          () => console.log("REACT-LOCAL-PHOTO: " + err.message)
        )
      );

    //readFile.onerror = (err) => console.log(err.message);
    readFile.onloadend = (reader) => {
      this.setState({ readFile }, () => {
        if (reader.target.readyState === 2) {
          var props = {
            key: id + i,
            id,
            style: { ...lazyImageStyle, ...this.props.style },
            src: reader.target.result,
            className: this.props.className,
            alt: this.props.alt,
            onError: (err) =>
              this.setState({
                Errorf: err.target,
                Photo: null
              })
          };
          const data = Buffer.from(reader.target.result).toString("base64");
          this.setState(
            {
              Photo: React.createElement("img", props, null)
            },
            () => save(data)
          );
        }
      });
    };
  };
  getPhotos = (id, i, fallback, verbose) =>
    this.state.photoDB.readPhotos().then((prenotes) => {
      let photos = Object.values(prenotes);
      return this.setState({ photos }, () => {
        const deleteit = async () => {
          const ans = await this.handleDelete(id, i);
          ans && this.storePhoto(fallback, id, i);
        };
        //id = `${props.xtype}/${uriParser(props.id)}`
        const photo = photos.find((x) => x._id === id + i);
        if (!photo) {
          verbose &&
            console.log(
              "REACT-LOCAL-PHOTO: seeking to store photo in local storage"
            );
          this.storePhoto(fallback, id, i);
        } else if (photo.src !== fallback) {
          deleteit();
        } else {
          this.state.photoDB.db
            .get(id + i, { attachments: true })
            .then((doc) => {
              const o = doc._attachments && doc._attachments[id];
              if (o) {
                verbose &&
                  console.log(
                    "REACT-LOCAL-PHOTO: found stored photo in local storage"
                  );
                const blob = atob(o.data);

                const props = {
                  key: id + i,
                  id,
                  src: blob,
                  style: { ...lazyImageStyle, ...this.props.style },
                  alt: this.props.alt,
                  className: this.props.classname,
                  onError: (err) =>
                    this.setState({ Errorf: err.target, Photo: null })
                };
                this.setState({
                  Photo: React.createElement("img", props, null)
                });
              } else {
                deleteit();
              }
            })
            .catch((err) => console.log(err.message));
        }
      });
    });
  componentDidMount = () => {
    const { id, i, fallback, verbose } = this.props;

    this.getPhotos(id, i, fallback, verbose);
    //dropbox only permits blob & req bearer 12000+ day 4-5mb photo
  };
  componentWillUnmount = () => {
    if (this.state.readFile && this.state.readFile.readyState !== 2)
      this.state.readFile.abort();
  };
  render() {
    const { Photo, Errorf } = this.state;
    const {
      fallback,
      maxWidth,
      id,
      i,
      alt,
      className,
      style,
      buttonStyle
    } = this.props;
    return (
      <div style={{ width: "100%", position: "relative" }}>
        {/*<canvas ref={this.canvasOpen} />
        <canvas ref={this.canvasClosed} />*/}
        <div
          style={{
            ...lazyImageStyle,
            width: maxWidth
          }}
        >
          {Photo ? (
            Photo
          ) : !Errorf ? (
            <div style={{ width: "100%", position: "relative" }}>
              <button
                style={buttonStyle}
                onClick={() => this.storePhoto(fallback, id, i)}
              >
                restore photo
              </button>
              <div style={{ width: "100%", position: "relative" }}>
                <img
                  //ref={this.Photo}
                  alt={alt}
                  className={className}
                  src={fallback}
                  style={{ ...lazyImageStyle, ...style }}
                />
              </div>
            </div>
          ) : (
            <div className="loader" />
          )}
        </div>
      </div>
    );
  }
}
//why do this? 1. for development and build-deployment
//to check if photos are there and run either way, same code.
//2*. class is exported once, function is malleable exogenously?
//browser HTTP remembers each src url anyway*
//3~. can also use PouchDB to localstore blobs and URL.createObjectURL
//if plan wasn't to have in repository... expensive for github tho
//update when~
class LazyPhoto extends React.Component {
  //React.lazy deconstructed
  constructor(props) {
    super(props);
    this.state = {
      Errorf: 0
    };
    //this.Photo = React.createRef();
  }
  importer = async (uri) =>
    await new Promise((resolve) =>
      //no second ,reject neccesary since 'import' is a promise that is
      //synchronous? loading the default-'src' into <img/> happens next
      lazy(
        import(uri)
          .then((res) => resolve(JSON.stringify(res)))
          .catch((res) => resolve(JSON.stringify(res)))
      )
    );

  componentDidMount = async () => {
    var urlCreator = window.URL || window.webkitURL;
    const { className, style, alt, id, i } = this.props;
    const { locationPath } = this.state;
    const src = await this.importer(locationPath);
    const ref = src && JSON.parse(src);
    if (ref) {
      if (ref.default) {
        /*photo unsuccessful, ${open.default === "" ? `no photo src at path 
        :"failed/corrupt download from "}${prefix}Closed.png`)*/
        const props = {
          key: id + i,
          id,
          //ref: this.Photo,
          src: urlCreator.createObjectURL(ref.default), //JSON.parse(openSrc);
          className,
          style: { ...lazyImageStyle, ...style },
          alt,
          onError: () => {
            const { Errorf } = this.state;
            if (Errorf < 3) {
              this.setState({ Errorf: Errorf + 1 });
            } else {
              this.setState({ Errorf: 0 });
            }
          }
        };
        this.setState({ Photo: React.createElement("img", props, null) });
      } //else this.setState({ Errorf: open.name });
    } //this.mount(this.props.tileChosen);
  };
  render() {
    //console.log("test");
    const {
      i,
      fallback,
      tileType,
      maxWidth,
      id,
      alt,
      style,
      className,
      buttonStyle,
      nolabel,
      show,
      verbose
    } = this.props;
    const { Errorf, Photo } = this.state;
    //lazy requires dynamic-props outside of img.width:'100%'
    //(Errorf || closedError) && console.log("bypassed");
    //console.log(id + i);
    return (
      <div
        key={id + i}
        id={id}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "min-content",
          overflow: "hidden",
          transform: ".3s ease-in",
          alignItems: "flex-end",
          color: "white",
          width: show ? maxWidth : "0%",
          position: "relative",
          backgroundImage: "linear-gradient(rgb(0,0,20),rgb(20,20,80))"
        }}
      >
        {!nolabel && <span style={{ width: "max-content" }}>{id}</span>}
        <div
          style={{
            width: "100%",
            position: "relative"
          }}
        >
          {Errorf !== 0 ? (
            //for import() path
            <div
              style={{
                width: "100%",
                position: "relative",
                overflow: "hidden"
              }}
            >
              {Photo ? Photo : <div className="loader" />}
            </div>
          ) : (
            //if either fails || loadingError, just use
            //dropboxusercontent url & img.alt error handler

            <Composition
              verbose={verbose}
              i={i}
              alt={alt}
              style={style}
              className={className}
              id={id}
              fallback={fallback} // openSrc, closeSrc
              tileType={tileType} //dynamic-props
              maxWidth={maxWidth ? maxWidth : "100%"} //on window 'resize'
              buttonStyle={buttonStyle}
            />
          )}
        </div>
      </div>
    );
  }
}
export default LazyPhoto;
