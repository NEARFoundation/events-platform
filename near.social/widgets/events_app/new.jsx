const accountId = context.accountId;
if (!accountId) {
  return 'Please connect your NEAR wallet to create an activity';
}

const CONTRACT = 'events_v1.near';

const MIN_LENGTH_NAME = 4;
const MIN_LENGTH_DESCRIPTION = 10;
const MILLISECONDS_IN_DAY = 86400000;
const DAYS_IN_WEEK = 7;

const TODAY =
  Math.floor((Date.now() + 0) / MILLISECONDS_IN_DAY) * MILLISECONDS_IN_DAY;
const TOMORROW = TODAY + MILLISECONDS_IN_DAY;
const ONE_WEEK = DAYS_IN_WEEK * MILLISECONDS_IN_DAY;

const DEFAULT_STATE = {
  name: 'T',
  type: '',
  category: '',
  status: '',
  start_date: new Date(TODAY + ONE_WEEK),
  end_date: new Date(TOMORROW + ONE_WEEK),
  location: '',
  image: '',
  links: [],
  description: '',

  errors: {},
};

State.init(DEFAULT_STATE);
if (!state) {
  return <div>Loading...</div>;
}

const BG_DEFAULT = '#f0f0f0';
const BG_CARD = '#fff';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  background-color: ${BG_DEFAULT};
`;

// NOTE: `form` is not supported
const Form = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem 0;
  background-color: ${BG_CARD};
`;

const Input = styled.input`
  width: 100%;
  padding: 0.5rem;
  margin: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;

  /* on hover */
  &:hover {
    border: 1px solid #666;
  }

  /* on focus */
  &:focus {
    border: 1px solid #aac;
    outline: none;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 0.5rem;
  margin: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  background-color: #ccc;
`;

const LinkRemoveButton = styled.button`
  width: 100%;
  padding: 0.5rem;
  margin: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  background-color: #caa;
  color: #fff;
`;

const LinkAddButton = styled.button`
  width: 100%;
  padding: 0.5rem;
  margin: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  background-color: #cfc;
  color: #fff;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  margin: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
`;

const Label = styled.label`
  width: 100%;
  color: #666;
  padding: 0.5rem 0;
  margin: 0.5rem 0 0 0;
  box-sizing: border-box;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.5rem;
  margin: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
`;

const FormSection = styled.div`
  width: 100%;
  padding: 0 1rem;
  margin: 0.5rem 0;
  box-sizing: border-box;
`;

const Error = styled.div`
  color: red;
  font-size: 0.8rem;
  margin: 0;
`;

const EventStatus = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EventTypes = [
  { value: 'virtual', label: 'Online' },
  { value: 'irl', label: 'In Person' },
  { value: 'mixed', label: 'Both' },
];

function addError(key, message) {
  console.log('addError', key, message);
  State.update({ errors: { ...state.errors, [key]: message } });
}

function clearError(key) {
  State.update({ errors: { ...state.errors, [key]: null } });
}

function getError(key) {
  return state.errors[key];
}

function assertCondition(valid, condition, key, message) {
  console.log('assertCondition', valid, condition, key);
  if (!condition) {
    addError(key, message);
    return false;
  }
  clearError(key);
  return valid;
}

function sanitize(data) {
  const {
    name,
    type,
    category,
    status,
    start_date,
    end_date,
    location,
    image,
    links,
    description,
  } = data;
  return {
    name,
    type,
    category,
    status,
    start_date: new Date(start_date).getTime(),
    end_date: new Date(end_date).getTime(),
    location,
    image,
    links,
    description,
  };
}

function validate(data) {
  let valid = true;

  const { name, description } = data;

  valid = assertCondition(
    valid,
    name.length >= MIN_LENGTH_NAME,
    'name',
    `Name must be at least ${MIN_LENGTH_NAME} characters long`
  );

  valid = assertCondition(
    valid,
    description.length >= MIN_LENGTH_DESCRIPTION,
    'description',
    `Description must be at least ${MIN_LENGTH_DESCRIPTION} characters long`
  );

  return valid;
}

function callContract(data) {
  const {
    name,
    type,
    category,
    status,
    start_date,
    end_date,
    location,
    image,
    links,
    description,
  } = data;
  Near.call(CONTRACT, 'create_event', {
    account_id: accountId,
    name,
    type,
    category,
    status,
    start_date,
    end_date,
    location,
    image,
    links,
    description,
  });
}

function sanitizeValidateAndCall(data) {
  const sanitized = sanitize(data);
  const valid = validate(sanitized);
  if (valid) {
    callContract(sanitized);
  }
}

function sanitizeAndValidate(data) {
  const sanitized = sanitize(data);
  validate(sanitized);
}

const updateState = (event, key) => {
  State.update({ [key]: event.target.value });
  sanitizeAndValidate({ ...state, [key]: event.target.value });
};

console.log('RENDER', state);
return (
  <Container>
    <Form>
      <h1>Create Event</h1>

      <FormSection>
        <Label>Name</Label>
        <Input
          type="text"
          placeholder="Event Name"
          value={state.name || ''}
          onChange={(event) => {
            updateState(event, 'name');
          }}
        />
        <Error>{getError('name')}</Error>
      </FormSection>

      <FormSection>
        <Label>Type</Label>
        <Select
          value={state.type}
          onChange={(event) => {
            updateState(event, 'type');
          }}
        >
          {EventTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>
        <Error>{getError('type')}</Error>
      </FormSection>

      <FormSection>
        <Label>Category</Label>
        <Input
          type="text"
          placeholder="Event Category"
          value={state.category}
          onChange={(event) => {
            updateState(event, 'category');
          }}
        />
        <Error>{getError('category')}</Error>
      </FormSection>

      <FormSection>
        <Label>Status</Label>
        <Select
          value={state.status}
          onChange={(event) => {
            updateState(event, 'status');
          }}
        >
          {EventStatus.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </Select>
        <Error>{getError('status')}</Error>
      </FormSection>

      <FormSection>
        <Label>Start Date</Label>
        <Input
          type="date"
          value={state.start_date}
          onChange={(event) => {
            updateState(event, 'start_date');
          }}
        />
        <Error>{getError('start_date')}</Error>
      </FormSection>

      <FormSection>
        <Label>End Date</Label>
        <Input
          type="date"
          value={state.end_date}
          onChange={(event) => {
            updateState(event, 'end_date');
          }}
        />
        <Error>{getError('end_date')}</Error>
      </FormSection>

      <FormSection>
        <Label>Location</Label>
        <TextArea
          placeholder="Event Location"
          value={state.location}
          onChange={(event) => {
            updateState(event, 'location');
          }}
          rows={3}
        />
        <Error>{getError('location')}</Error>
      </FormSection>

      <FormSection>
        <Label>Image</Label>
        <IpfsImageUpload
          image={state.image}
          onChange={(event) => {
            updateState(event, 'image');
          }}
        />
        <Error>{getError('image')}</Error>
      </FormSection>

      <FormSection>
        <Label>Links</Label>
        {state.links.map((link, index) => (
          <div key={index}>
            <Input
              type="text"
              placeholder="Event Link"
              value={link}
              onChange={(event) => {
                const links = [...state.links];
                links[index] = event.target.value;
                State.update({ links });
                sanitizeAndValidate({ ...state, links });
              }}
            />
            <LinkRemoveButton
              onClick={() => {
                const links = [...state.links];
                links.splice(index, 1);
                State.update({ links });
                sanitizeAndValidate({ ...state, links });
              }}
            >
              Remove
            </LinkRemoveButton>
          </div>
        ))}
        <LinkAddButton
          onClick={() => {
            const links = [...state.links];
            links.push('');
            State.update({ links });
            sanitizeAndValidate({ ...state, links });
          }}
        >
          Add Link
        </LinkAddButton>
        <Error>{getError('links')}</Error>
      </FormSection>

      <FormSection>
        <Label>Description</Label>
        <TextArea
          placeholder="Event Description"
          value={state.description}
          onChange={(event) => {
            updateState(event, 'description');
          }}
          rows={3}
        />
        <Error>{getError('description')}</Error>
      </FormSection>

      <Button
        onClick={() => {
          sanitizeValidateAndCall(state);
        }}
      >
        Create Event
      </Button>
    </Form>
    {/* TODO: add Back Button */}
  </Container>
);
