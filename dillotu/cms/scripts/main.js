(function(window, $, firebase, config, undefined) {
  'use strict'

  // Shortcuts to DOM Elements.

  // Auth
  var signInSection = $('#sign-in')
  var signInForm = $('#signin-form')
  var signInEmail = $('#signin-email')
  var signInPassword = $('#signin-password')
  var signOutButton = $('#sign-out-button')

  // Sections
  var pendingPostsMenuButton = $('#menu-pending-posts')
  var pendingPostsSection = $('#pending-posts-list')

  var approvedPostsMenuButton = $('#menu-approved-posts')
  var approvedPostsSection = $('#approved-posts-list')

  var discardedPostsMenuButton = $('#menu-discarded-posts')
  var discardedPostsSection = $('#discarded-posts-list')

  // Initialize Firebase listeners.
  var listeningFirebaseRefs = []
  var posts = {}
  /**
   * Saves a new post to the Firebase DB.
   */
  // [START write_fan_out]
  function writeNewPost(username, body) {
    // A post entry.
    var postData = {
      author: username,
      body: body
    }

    // Get a key for a new Post.
    var newPostKey = firebase.database().ref().child('pending-posts').push().key
    // Write the new post's data in the pending posts list.
    var updates = {}
    updates['/pending-posts/' + newPostKey] = postData

    return firebase.database().ref().update(updates)
  }
  // [END write_fan_out]

  /**
   * Approve/Discard post.
   */
  // [START post_approvation_transaction]
  function toggleApprovation(postRef, postId, approved) {
    var updates = {}
    postRef.transaction(function(post) {
      if (post) {
        if (approved) {
          // Write the new post's data simultaneously in the posts list and the user's post list.
          updates['/approved-posts/' + postId] = post
          updates['/discarded-posts/' + postId] = null
          updates['/pending-posts/' + postId] = null
        } else {
          // Write the new post's data simultaneously in the posts list and the user's post list.
          updates['/discarded-posts/' + postId] = post
          updates['/approved-posts/' + postId] = null
          updates['/pending-posts/' + postId] = null
        }
      }
      return post
    })
    .then(function(){
      return firebase.database().ref().update(updates)
    })
    .catch(function(error){ console.error(error) })
    listeningFirebaseRefs.push(postRef)
  }
  // [END post_approvation_transaction]

  /**
   * Creates a post element.
   */
  function createPostElement(post) {
    var html =
        '<div class="post mdl-cell mdl-cell--12-col ' +
                    'mdl-cell--6-col-tablet mdl-cell--4-col-desktop mdl-grid mdl-grid--no-spacing">' +
          '<div class="mdl-card mdl-shadow--2dp">' +
            '<div class="header">' +
              '<div>' +
                '<div class="text mdl-color-text--black"></div>' +
              '</div>' +
            '</div>' +
            '<div class="thumb">' +
              '<span class="thumb_down material-icons">thumb_down</span>' +
              '<span class="thumb_up material-icons">thumb_up</span>' +
            '</div>' +
            '<div class="username"></div>' +
          '</div>' +
        '</div>'

    // Create the DOM element from the HTML.
    var div = document.createElement('div')
    div.innerHTML = html
    var postElement = div.firstChild
    postElement.id = post.key

    var approve = postElement.getElementsByClassName('thumb_up')[0]
    var discard = postElement.getElementsByClassName('thumb_down')[0]

    // Set values.
    postElement.getElementsByClassName('text')[0].innerText = post.body
    postElement.getElementsByClassName('username')[0].innerText = post.author || 'Anonymous'

    // Bind starring action.
    var approvePost = function() {
      var globalPostRef = firebase.database().ref('/' + post.path + '/' + post.key)
      toggleApprovation(globalPostRef, post.key, true)
    }
    var discardPost = function() {
      var globalPostRef = firebase.database().ref('/' + post.path + '/' + post.key)
      toggleApprovation(globalPostRef, post.key, false)
    }
    approve.onclick = approvePost
    discard.onclick = discardPost

    return postElement
  }

  /**
   * Updates the aproved status of the post.
   */
  function updateApproved(postElement, approved) {
    if (approved) {
      postElement.getElementsByClassName('starred')[0].style.display = 'inline-block'
      postElement.getElementsByClassName('not-starred')[0].style.display = 'none'
    } else {
      postElement.getElementsByClassName('starred')[0].style.display = 'none'
      postElement.getElementsByClassName('not-starred')[0].style.display = 'inline-block'
    }
  }

  /**
   * Starts listening for new posts and populates posts lists.
   */
  function startDatabaseQueries() {
    // [START posts query]
    var approvedPostsRef = firebase.database().ref('approved-posts')
    var discardedPostsRef = firebase.database().ref('discarded-posts')
    var pendingPostsRef = firebase.database().ref('pending-posts')
    // [END posts query]

    var fetchPosts = function(postsRef, sectionElement) {
      postsRef.on('child_added', function(data) {
        var postObj = {
          key: data.key,
          path: data.ref.path.o[0],
          author: data.val().author || 'Anonymous',
          body: data.val().body || ''
        }

        var containerElement = sectionElement.find('.posts-container')[0]
        containerElement.insertBefore(
            createPostElement(postObj),
            containerElement.firstChild)
      })
      postsRef.on('child_removed', function(data) {
        var containerElement = sectionElement.find('.posts-container')[0]
        containerElement.querySelector('#' + data.key).remove()
      })
    }

    // Fetching and displaying all posts of each sections.
    fetchPosts(pendingPostsRef, pendingPostsSection)
    fetchPosts(approvedPostsRef, approvedPostsSection)
    fetchPosts(discardedPostsRef, discardedPostsSection)

    // Keep track of all Firebase refs we are listening to.
    listeningFirebaseRefs.push(pendingPostsRef)
    listeningFirebaseRefs.push(approvedPostsRef)
    listeningFirebaseRefs.push(discardedPostsRef)
  }

  /**
   * Writes the user's data to the database.
   */
  // [START basic_write]
  function writeUserData(userId, name, email, imageUrl) {
    firebase.database().ref('users/' + userId).set({
      username: name,
      email: email,
      profile_picture : imageUrl
    })
  }
  // [END basic_write]

  /**
   * Cleanups the UI and removes all Firebase listeners.
   */
  function cleanupUi() {
    // Remove all previously displayed posts.
    pendingPostsSection.find('.posts-container').text('')
    approvedPostsSection.find('.posts-container').text('')
    discardedPostsSection.find('.posts-container').text('')

    // Stop all currently listening Firebase listeners.
    listeningFirebaseRefs.forEach(function(ref) {
      ref.off()
    })
    listeningFirebaseRefs = []
  }

  /**
   * The ID of the currently signed-in User. Keep track of this to detect Auth state change events that are just
   * programmatic token refresh but not a User status change.
   */
  var currentUID = null

  /**
   * Triggers every time there is a change in the Firebase auth state (i.e. user signed-in or user signed out).
   */
  function onAuthStateChanged(user) {
    // Ignore token refresh events.
    if (user && currentUID === user.uid) {
      return
    }

    cleanupUi()
    if (user) {
      // New user signed in: set current user id and hide sign in section
      currentUID = user.uid
      signInSection.hide()
      // Save user data to db
      writeUserData(user.uid, user.displayName, user.email, user.photoURL)
      // Fetch db data
      startDatabaseQueries()
    } else {
      // Logout: clear current user id and show sign in section
      currentUID = null
      signInSection.show()
    }
  }

  /**
   * Displays the given section element and changes styling of the given button.
   */
  function showSection(sectionElement, buttonElement) {
    pendingPostsSection.hide()
    approvedPostsSection.hide()
    discardedPostsSection.hide()
    pendingPostsMenuButton.removeClass('is-active')
    approvedPostsMenuButton.removeClass('is-active')
    discardedPostsMenuButton.removeClass('is-active')

    if (sectionElement) {
      sectionElement.show()
    }
    if (buttonElement) {
      buttonElement.addClass('is-active')
    }
  }

  // Bindings on load.
  window.addEventListener('load', function() {

    // Sign in on form submit.
    signInForm.submit(function(e) {
      e.preventDefault()
      var email = signInEmail.val()
      var password = signInPassword.val()
      if (email && password) {
        firebase.auth().signInWithEmailAndPassword(email, password)
        .then(function(){
          signInEmail.val('')
          signInPassword.val('')
        })
        .catch(function(error) {
          // Handle Errors here.
          var errorCode = error.code
          var errorMessage = error.message
          console.error(error)
        })
      }
    })

    // Bind Sign out button.
    signOutButton.on('click', function() {
      firebase.auth().signOut()
    })

    // Listen for auth state changes
    firebase.auth().onAuthStateChanged(onAuthStateChanged)

    // Bind menu buttons.
    pendingPostsMenuButton.click(function() {
      showSection(pendingPostsSection, $(this))
    })
    approvedPostsMenuButton.click(function() {
      showSection(approvedPostsSection, $(this))
    })
    discardedPostsMenuButton.click(function() {
      showSection(discardedPostsSection, $(this))
    })

    // Show initial section
    showSection(pendingPostsSection, pendingPostsMenuButton)
  }, false)

  firebase.initializeApp(config)
}(window, window.jQuery, window.firebase, window.config))
